import type { DomainEvent } from "./events";

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

export type SessionId = { readonly __brand: "SessionId"; readonly value: string };
export const makeSessionId = (value: string): SessionId => ({ __brand: "SessionId", value });

export type CartIdRef = { readonly __brand: "CartIdRef"; readonly value: string };
export const makeCartIdRef = (value: string): CartIdRef => ({ __brand: "CartIdRef", value });

export type UserIdRef = { readonly __brand: "UserIdRef"; readonly value: string };
export const makeUserIdRef = (value: string): UserIdRef => ({ __brand: "UserIdRef", value });

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
