import type { Maybe } from "@fabric/types";
import type { DisplayName, Email, UserId, UserRole } from "@fabric/types";
import type { Temporal } from "@js-temporal/polyfill";

export interface User {
  readonly id: UserId;
  readonly email: Email;
  readonly role: UserRole;
  readonly displayName: Maybe<DisplayName>;
  readonly createdAt: Temporal.Instant;
  readonly updatedAt: Temporal.Instant;
  readonly emailVerifiedAt: Maybe<Temporal.Instant>;
}
