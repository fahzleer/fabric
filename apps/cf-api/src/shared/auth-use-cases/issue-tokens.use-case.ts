import type { Result, TokenIssuanceError, TokenPair, UserRole } from "@fabric/types";
import { Err, Ok, TokenIssuanceError as makeIssuanceErr } from "@fabric/types";
import { None } from "@fabric/types";
import { Temporal } from "@js-temporal/polyfill";
import type {
  ITokenRepositoryPort,
  StoredRefreshToken,
} from "../../infrastructure/firebase/firebase-token.repository";

export type IssueTokensInput = {
  readonly userId: string;
  readonly email: string;
  readonly role: UserRole;
};

export type EncryptTokenFn = (
  payload: Record<string, unknown>,
  keyHex: string,
  ttlSeconds: number
) => Promise<Result<string, TokenIssuanceError>>;

export type IssueTokensDeps = {
  readonly tokenRepo: ITokenRepositoryPort;
  readonly pasetoKey: string;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly encryptToken?: EncryptTokenFn;
};

async function defaultEncryptToken(
  payload: Record<string, unknown>,
  key: string,
  ttlSeconds: number
): Promise<Result<string, TokenIssuanceError>> {
  try {
    const { encryptToken } = await import("../../infrastructure/auth/paseto-verifier.service");
    return encryptToken(payload, key, ttlSeconds);
  } catch (e) {
    return Err(makeIssuanceErr(`Failed to encrypt token: ${String(e)}`));
  }
}

function hashToken(raw: string): string {
  const { createHash } = require("node:crypto");
  return createHash("sha256").update(raw).digest("hex");
}

export const issueTokens = async (
  input: IssueTokensInput,
  deps: IssueTokensDeps
): Promise<Result<TokenPair, TokenIssuanceError>> => {
  const now = Temporal.Now.instant();
  const accessJti = crypto.randomUUID();
  const refreshJti = crypto.randomUUID();
  const tokenFamily = crypto.randomUUID();

  const encrypt = deps.encryptToken ?? defaultEncryptToken;

  const accessPayload = {
    sub: input.userId,
    email: input.email,
    role: input.role,
    iat: now.toString(),
    jti: accessJti,
  };
  const accessTokenResult = await encrypt(
    accessPayload,
    deps.pasetoKey,
    deps.accessTokenTtlSeconds
  );
  if (accessTokenResult._tag === "Err") return accessTokenResult;

  const refreshPayload = {
    sub: input.userId,
    email: input.email,
    role: input.role,
    fam: tokenFamily,
    iat: now.toString(),
    jti: refreshJti,
  };
  const refreshTokenResult = await encrypt(
    refreshPayload,
    deps.pasetoKey,
    deps.refreshTokenTtlSeconds
  );
  if (refreshTokenResult._tag === "Err") return refreshTokenResult;

  const rawRefreshToken = refreshTokenResult.value;
  const expiresAt = now.add({ seconds: deps.refreshTokenTtlSeconds });

  const storedToken: StoredRefreshToken = {
    id: refreshJti,
    userId: input.userId,
    tokenFamily,
    tokenHash: hashToken(rawRefreshToken),
    expiresAt,
    revokedAt: None(),
    createdAt: now,
  };

  const saveResult = await deps.tokenRepo.save(storedToken);
  if (saveResult._tag === "Err") {
    return Err(makeIssuanceErr(`Failed to persist refresh token: ${saveResult.error.message}`));
  }

  return Ok({ accessToken: accessTokenResult.value, refreshToken: rawRefreshToken });
};
