import type { UserRole } from "@fabric/types";
import type { UserId } from "../../domain/user/user.value-objects";
import { presentDomainError } from "../../features/shared/http-error.presenter";
import type { PasetoVerifierService } from "./paseto-verifier.service";

export async function resolveUserId(
  pasetoVerifier: PasetoVerifierService,
  authHeader: string | undefined
): Promise<UserId> {
  const tokenResult = pasetoVerifier.extractBearerToken(authHeader);
  if (tokenResult._tag === "Err") return presentDomainError(tokenResult.error);

  const payloadResult = await pasetoVerifier.verify(tokenResult.value);
  if (payloadResult._tag === "Err") return presentDomainError(payloadResult.error);

  return payloadResult.value.sub as UserId;
}

export type ResolvedUser = {
  readonly userId: UserId;
  readonly role: UserRole;
};

export async function resolveUser(
  pasetoVerifier: PasetoVerifierService,
  authHeader: string | undefined
): Promise<ResolvedUser> {
  const tokenResult = pasetoVerifier.extractBearerToken(authHeader);
  if (tokenResult._tag === "Err") return presentDomainError(tokenResult.error);

  const payloadResult = await pasetoVerifier.verify(tokenResult.value);
  if (payloadResult._tag === "Err") return presentDomainError(payloadResult.error);

  const payload = payloadResult.value;
  return {
    userId: payload.sub as UserId,
    role: (payload.role ?? "customer") as UserRole,
  };
}
