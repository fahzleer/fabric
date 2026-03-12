import type { MemcachedAdapter } from "@fabric/cache";
import type { Result } from "@fabric/types";
import { type } from "arktype";
import type { Hono } from "hono";
import type { PasetoVerifierService } from "../../infrastructure/auth/paseto-verifier.service";
import type { FirebaseActivityRepository } from "../../infrastructure/firebase/firebase-activity.repository";
import type { FirebaseLockoutAdapter } from "../../infrastructure/firebase/firebase-lockout.adapter";
import type { FirebaseTokenRepository } from "../../infrastructure/firebase/firebase-token.repository";
import type { FirebaseUserAdapter } from "../../infrastructure/firebase/firebase-user.adapter";
import { requireAuth, throttle } from "../../infrastructure/guards/auth.middleware";
import { log } from "../../infrastructure/monitoring/logger";
import { hashPassword } from "../../infrastructure/password/password.service";
import { loginWithFacebook } from "../../shared/auth-use-cases/facebook-login.use-case";
import type {
  FacebookProfile,
  InvalidFacebookTokenError,
} from "../../shared/auth-use-cases/facebook-login.use-case";
import { loginWithGoogle } from "../../shared/auth-use-cases/google-login.use-case";
import type {
  GoogleProfile,
  InvalidGoogleTokenError,
} from "../../shared/auth-use-cases/google-login.use-case";
import { issueTokens } from "../../shared/auth-use-cases/issue-tokens.use-case";
import { login } from "../../shared/auth-use-cases/login.use-case";

const LoginBody = type({
  email: "string >= 3",
  password: "string >= 1",
});

const RegisterBody = type({
  email: "string >= 3",
  password: "string >= 8",
  displayName: "string >= 1",
  "role?": '"customer" | "store_owner"',
});

function getPasetoKey(): string {
  return process.env.PASETO_KEY ?? "";
}
function getAccessTtl(): number {
  return Number.parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS ?? "900", 10);
}
function getRefreshTtl(): number {
  return Number.parseInt(process.env.REFRESH_TOKEN_TTL_SECONDS ?? "604800", 10);
}

export function registerAuthRoutes(
  app: Hono,
  userAdapter: FirebaseUserAdapter,
  tokenRepo: FirebaseTokenRepository,
  lockoutStore: FirebaseLockoutAdapter,
  verifier: PasetoVerifierService,
  activityRepo: FirebaseActivityRepository,
  memcached: MemcachedAdapter
): void {
  const loginRateLimit = throttle(memcached, { limit: 10, windowMs: 60_000 });
  const registerRateLimit = throttle(memcached, { limit: 5, windowMs: 60_000 });

  app.post("/auth/login", loginRateLimit, async (c) => {
    const body = await c.req.json();
    const validated = LoginBody(body);
    if (validated instanceof type.errors) {
      return c.json({ error: validated.summary }, 400);
    }

    const ip = c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for") ?? "";
    const userAgent = c.req.header("user-agent") ?? "";

    const result = await login(
      { email: validated.email, password: validated.password },
      { userReader: userAdapter, lockoutStore, tokenService: { issue: issueTokensFn(tokenRepo) } }
    );

    if (result._tag === "Err") {
      void activityRepo.track({
        id: crypto.randomUUID(),
        eventType: "user_login_failed",
        eventData: { email: validated.email, reason: result.error.message },
        ipAddress: ip,
        userAgent,
      });
      return c.json({ error: result.error.message }, 401);
    }

    void activityRepo.track({
      id: crypto.randomUUID(),
      eventType: "user_logged_in",
      eventData: { method: "email" },
      ipAddress: ip,
      userAgent,
    });

    return c.json({
      accessToken: result.value.accessToken,
      refreshToken: result.value.refreshToken,
    });
  });

  app.post("/auth/register", registerRateLimit, async (c) => {
    const body = await c.req.json();
    const validated = RegisterBody(body);
    if (validated instanceof type.errors) {
      return c.json({ error: validated.summary }, 400);
    }

    const hashResult = await hashPassword(validated.password);
    if (hashResult._tag === "Err") {
      return c.json({ error: hashResult.error.message }, 500);
    }

    const userId = crypto.randomUUID();
    const result = await userAdapter.createUser({
      id: userId,
      email: validated.email.toLowerCase(),
      passwordHash: hashResult.value,
      role: validated.role ?? "customer",
      displayName: validated.displayName,
    });

    if (result._tag === "Err") {
      if (result.error.message.includes("already registered")) {
        return c.json({ error: "Email already registered" }, 409);
      }
      return c.json({ error: result.error.message }, 500);
    }

    void activityRepo.track({
      id: crypto.randomUUID(),
      userId,
      eventType: "user_registered",
      eventData: { role: validated.role ?? "customer", method: "email" },
      ipAddress: c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for") ?? "",
      userAgent: c.req.header("user-agent") ?? "",
    });

    return c.json({ registered: true }, 201);
  });

  app.post("/auth/register/store", registerRateLimit, async (c) => {
    const body = await c.req.json();
    const validated = RegisterBody(body);
    if (validated instanceof type.errors) {
      return c.json({ error: validated.summary }, 400);
    }

    const hashResult = await hashPassword(validated.password);
    if (hashResult._tag === "Err") {
      return c.json({ error: hashResult.error.message }, 500);
    }

    const userId = crypto.randomUUID();
    const result = await userAdapter.createUser({
      id: userId,
      email: validated.email.toLowerCase(),
      passwordHash: hashResult.value,
      role: "store_owner",
      displayName: validated.displayName,
    });

    if (result._tag === "Err") {
      if (result.error.message.includes("already registered")) {
        return c.json({ error: "Email already registered" }, 409);
      }
      return c.json({ error: result.error.message }, 500);
    }

    void activityRepo.track({
      id: crypto.randomUUID(),
      userId,
      eventType: "user_registered",
      eventData: { role: "store_owner", method: "email" },
      ipAddress: c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for") ?? "",
      userAgent: c.req.header("user-agent") ?? "",
    });

    return c.json({ registered: true }, 201);
  });

  app.post("/auth/refresh", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    if (!body || typeof body.refreshToken !== "string") {
      return c.json({ error: "refreshToken is required" }, 400);
    }

    const verifyResult = await verifier.verify(body.refreshToken);
    if (verifyResult._tag === "Err") {
      return c.json({ error: "Invalid or expired refresh token" }, 401);
    }
    const payload = verifyResult.value as typeof verifyResult.value & { jti: string; fam?: string };
    const jti = payload.jti;
    const tokenFamily = payload.fam ?? "";

    const isBlacklisted = await tokenRepo.isBlacklisted(jti);
    if (isBlacklisted) {
      await tokenRepo.revokeFamily(tokenFamily);
      log.warn("Refresh token reuse detected — family revoked", { jti, userId: payload.sub });
      return c.json({ error: "Refresh token has been revoked" }, 401);
    }

    const storedResult = await tokenRepo.findByJti(jti);
    if (storedResult._tag === "Err" || storedResult.value === null) {
      return c.json({ error: "Refresh token not found" }, 401);
    }
    if (storedResult.value.revokedAt._tag === "Some") {
      await tokenRepo.revokeFamily(tokenFamily);
      return c.json({ error: "Refresh token has been revoked" }, 401);
    }

    const { Temporal } = await import("@js-temporal/polyfill");
    await tokenRepo.revokeFamily(tokenFamily);
    await tokenRepo.blacklist(jti, Temporal.Now.instant().add({ seconds: getRefreshTtl() }));

    const newPairResult = await issueTokens(
      {
        userId: payload.sub as string,
        email: payload.email as string,
        role: payload.role as import("@fabric/types").UserRole,
      },
      {
        tokenRepo,
        pasetoKey: getPasetoKey(),
        accessTokenTtlSeconds: getAccessTtl(),
        refreshTokenTtlSeconds: getRefreshTtl(),
      }
    );

    if (newPairResult._tag === "Err") {
      return c.json({ error: "Failed to issue new tokens" }, 500);
    }

    return c.json({
      accessToken: newPairResult.value.accessToken,
      refreshToken: newPairResult.value.refreshToken,
    });
  });

  app.post("/auth/login/facebook", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    if (!body || typeof body.access_token !== "string" || body.access_token.length < 1) {
      return c.json({ error: "access_token is required" }, 400);
    }

    const ip = c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for") ?? "";
    const userAgent = c.req.header("user-agent") ?? "";

    const result = await loginWithFacebook(body.access_token, {
      verifyFacebookToken: verifyFacebookTokenViaGraphApi,
      userAdapter: {
        findByEmail: async (email: string) => {
          const found = await userAdapter.findByEmail(email);
          if (found._tag === "Err" && found.error.message.includes("User not found")) {
            return { _tag: "Ok" as const, value: null };
          }
          return found as import("@fabric/types").Result<
            {
              id: { value: string };
              email: { value: string };
              role: import("@fabric/types").UserRole;
            } | null,
            import("@fabric/types").RepositoryError
          >;
        },
        createUser: (input: {
          id: string;
          email: string;
          passwordHash: string;
          role: import("@fabric/types").UserRole;
          displayName: string;
        }) => userAdapter.createUser(input),
      },
      tokenService: { issue: issueTokensFn(tokenRepo) },
    });

    if (result._tag === "Err") {
      void activityRepo.track({
        id: crypto.randomUUID(),
        eventType: "user_login_failed",
        eventData: { method: "facebook", reason: result.error.message },
        ipAddress: ip,
        userAgent,
      });
      const status =
        result.error._tag === "InvalidFacebookToken"
          ? 401
          : result.error._tag === "EmailNotProvided"
            ? 422
            : 500;
      return c.json({ error: result.error.message }, status);
    }

    void activityRepo.track({
      id: crypto.randomUUID(),
      eventType: "user_logged_in",
      eventData: { method: "facebook" },
      ipAddress: ip,
      userAgent,
    });

    return c.json({
      accessToken: result.value.accessToken,
      refreshToken: result.value.refreshToken,
    });
  });

  app.post("/auth/login/google", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    if (!body || typeof body.id_token !== "string" || body.id_token.length < 1) {
      return c.json({ error: "id_token is required" }, 400);
    }

    const ip = c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for") ?? "";
    const userAgent = c.req.header("user-agent") ?? "";

    const result = await loginWithGoogle(body.id_token, {
      verifyGoogleToken: verifyGoogleTokenViaApi,
      userAdapter: {
        findByEmail: async (email: string) => {
          const found = await userAdapter.findByEmail(email);
          if (found._tag === "Err" && found.error.message.includes("User not found")) {
            return { _tag: "Ok" as const, value: null };
          }
          return found as import("@fabric/types").Result<
            {
              id: { value: string };
              email: { value: string };
              role: import("@fabric/types").UserRole;
            } | null,
            import("@fabric/types").RepositoryError
          >;
        },
        createUser: (input: {
          id: string;
          email: string;
          passwordHash: string;
          role: import("@fabric/types").UserRole;
          displayName: string;
        }) => userAdapter.createUser(input),
      },
      tokenService: { issue: issueTokensFn(tokenRepo) },
    });

    if (result._tag === "Err") {
      void activityRepo.track({
        id: crypto.randomUUID(),
        eventType: "user_login_failed",
        eventData: { method: "google", reason: result.error.message },
        ipAddress: ip,
        userAgent,
      });
      const status =
        result.error._tag === "InvalidGoogleToken"
          ? 401
          : result.error._tag === "EmailNotProvided"
            ? 422
            : 500;
      return c.json({ error: result.error.message }, status);
    }

    void activityRepo.track({
      id: crypto.randomUUID(),
      eventType: "user_logged_in",
      eventData: { method: "google" },
      ipAddress: ip,
      userAgent,
    });

    return c.json({
      accessToken: result.value.accessToken,
      refreshToken: result.value.refreshToken,
    });
  });

  app.post("/auth/logout", requireAuth(verifier), async (c) => {
    const authHeader = c.req.header("authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const userId = c.get("userId") as string | undefined;

    if (token) {
      const payload = await verifier.verify(token).catch(() => undefined);
      if (payload && typeof payload === "object" && "jti" in payload) {
        const { Temporal } = await import("@js-temporal/polyfill");
        await tokenRepo.blacklist(
          payload.jti as string,
          Temporal.Now.instant().add({ seconds: getAccessTtl() })
        );
      }
    }

    if (userId) {
      void activityRepo.track({
        id: crypto.randomUUID(),
        userId,
        eventType: "user_logged_out",
        eventData: {},
        ipAddress: c.req.header("x-real-ip") ?? c.req.header("x-forwarded-for") ?? "",
        userAgent: c.req.header("user-agent") ?? "",
      });
    }

    return c.json({ loggedOut: true });
  });
}

async function verifyFacebookTokenViaGraphApi(
  accessToken: string
): Promise<Result<FacebookProfile, InvalidFacebookTokenError>> {
  try {
    const url = `https://graph.facebook.com/me?fields=id,email,name&access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      id?: string;
      email?: string;
      name?: string;
      error?: { message: string };
    };

    if (!res.ok || data.error || !data.id) {
      return {
        _tag: "Err",
        error: {
          _tag: "InvalidFacebookToken",
          message: data.error?.message ?? "Invalid or expired Facebook access token",
        },
      };
    }

    return {
      _tag: "Ok",
      value: {
        id: data.id,
        ...(data.email !== undefined && { email: data.email }),
        name: data.name ?? "Facebook User",
      },
    };
  } catch (e) {
    return {
      _tag: "Err",
      error: {
        _tag: "InvalidFacebookToken",
        message: `Facebook API request failed: ${String(e)}`,
      },
    };
  }
}

async function verifyGoogleTokenViaApi(
  idToken: string
): Promise<Result<GoogleProfile, InvalidGoogleTokenError>> {
  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      sub?: string;
      email?: string;
      name?: string;
      email_verified?: string;
      aud?: string;
      error_description?: string;
    };

    if (!res.ok || data.error_description || !data.sub) {
      return {
        _tag: "Err",
        error: {
          _tag: "InvalidGoogleToken",
          message: data.error_description ?? "Invalid or expired Google ID token",
        },
      };
    }

    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && data.aud !== expectedClientId) {
      return {
        _tag: "Err",
        error: {
          _tag: "InvalidGoogleToken",
          message: "Google ID token audience mismatch",
        },
      };
    }

    return {
      _tag: "Ok",
      value: {
        sub: data.sub,
        ...(data.email !== undefined && { email: data.email }),
        name: data.name ?? "Google User",
      },
    };
  } catch (e) {
    return {
      _tag: "Err",
      error: {
        _tag: "InvalidGoogleToken",
        message: `Google API request failed: ${String(e)}`,
      },
    };
  }
}

function issueTokensFn(tokenRepo: FirebaseTokenRepository) {
  return async (userId: string, email: string, role: string) => {
    return issueTokens(
      { userId, email, role: role as import("@fabric/types").UserRole },
      {
        tokenRepo,
        pasetoKey: getPasetoKey(),
        accessTokenTtlSeconds: getAccessTtl(),
        refreshTokenTtlSeconds: getRefreshTtl(),
      }
    );
  };
}
