import type { DomainEvent } from "./events";
import type { Brand } from "./kernel";

const makeDomainEventInternal = <TType extends string, TPayload>(
  _type: TType,
  payload: TPayload
): DomainEvent<TType, TPayload> => ({
  _type,
  _version: 1,
  eventId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  payload,
});

export type SessionId = Brand<string, "SessionId">;
export const makeSessionId = (value: string): SessionId => value as SessionId;

export type CartIdRef = Brand<string, "CartIdRef">;
export const makeCartIdRef = (value: string): CartIdRef => value as CartIdRef;

export type UserIdRef = Brand<string, "UserIdRef">;
export const makeUserIdRef = (value: string): UserIdRef => value as UserIdRef;

export type SessionStartedPayload = {
  readonly sessionId: string;
  readonly userId?: string;
  readonly cartId?: string;
};
export type SessionStarted = DomainEvent<"SessionStarted", SessionStartedPayload>;
export const makeSessionStarted = (payload: SessionStartedPayload): SessionStarted =>
  makeDomainEventInternal("SessionStarted", payload);

export type SessionExpiredPayload = { readonly sessionId: string };
export type SessionExpired = DomainEvent<"SessionExpired", SessionExpiredPayload>;
export const makeSessionExpired = (payload: SessionExpiredPayload): SessionExpired =>
  makeDomainEventInternal("SessionExpired", payload);

export type SessionEvent = SessionStarted | SessionExpired;
