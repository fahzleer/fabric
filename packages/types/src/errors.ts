import type { TaggedError } from "./kernel";

export interface RepositoryError extends TaggedError<"RepositoryError"> {
  readonly cause?: unknown;
}

export const RepositoryError = (message: string, cause?: unknown): RepositoryError => ({
  _tag: "RepositoryError",
  message,
  cause,
});
