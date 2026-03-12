import type { UserRole } from "@fabric/types";

export interface AuthedFields {
  readonly userId: string;
  readonly role: UserRole;
}

export const isAuthed = <T>(ctx: T): ctx is T & AuthedFields =>
  typeof ctx === "object" && ctx !== null && "userId" in (ctx as object);
