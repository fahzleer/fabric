import { createSecretKey } from "node:crypto";
import type { AccessTokenPayload, Result, TokenError, TokenIssuanceError } from "@fabric/types";
import {
  Err,
  InvalidTokenError,
  Ok,
  TokenExpiredError,
  TokenIssuanceError as makeIssuanceErr,
} from "@fabric/types";
import { V3 } from "paseto";

export async function encryptToken(
  payload: Record<string, unknown>,
  keyHex: string,
  ttlSeconds: number
): Promise<Result<string, TokenIssuanceError>> {
  try {
    const keyBytes = Buffer.from(keyHex, "hex");
    const key = createSecretKey(keyBytes);
    const token = await V3.encrypt(payload, key, { expiresIn: `${ttlSeconds}s` });
    return Ok(token);
  } catch (e) {
    return Err(makeIssuanceErr(`Failed to encrypt token: ${String(e)}`));
  }
}

export class PasetoVerifierService {
  private readonly keyHex: string;

  constructor() {
    const keyHex = process.env.PASETO_KEY;
    if (keyHex === undefined || keyHex.trim().length !== 64) {
      throw new Error(
        "PASETO_KEY must be a 64-character hex string (32 bytes). " +
          "Set this env var before starting the api service."
      );
    }
    this.keyHex = keyHex.trim().toLowerCase();
  }

  async verify(accessToken: string): Promise<Result<AccessTokenPayload, TokenError>> {
    try {
      const keyBytes = Buffer.from(this.keyHex, "hex");
      const key = createSecretKey(keyBytes);
      const payload = (await V3.decrypt(accessToken, key)) as AccessTokenPayload;
      return Ok(payload);
    } catch (e) {
      const message = String(e);
      if (message.includes("token is expired") || message.includes("maxTokenAge")) {
        return Err(TokenExpiredError(`Access token has expired: ${message}`));
      }
      return Err(InvalidTokenError(`Invalid access token: ${message}`));
    }
  }

  extractBearerToken(authorizationHeader: string | undefined): Result<string, TokenError> {
    if (authorizationHeader === undefined || authorizationHeader.trim().length === 0) {
      return Err(InvalidTokenError("Authorization header is required"));
    }

    const parts = authorizationHeader.split(" ");
    if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer" || parts[1] === undefined) {
      return Err(InvalidTokenError("Authorization header must be in format: Bearer <token>"));
    }

    return Ok(parts[1]);
  }
}
