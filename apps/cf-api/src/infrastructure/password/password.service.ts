import type { PasswordHashError, Result } from "@fabric/types";
import { Err, Ok, PasswordHashError as makePasswordHashErr } from "@fabric/types";
import { hash, compare as verify } from "bcryptjs";

export const hashPassword = async (
  plaintext: string,
  rounds: number
): Promise<Result<string, PasswordHashError>> => {
  try {
    const hashed = await hash(plaintext, rounds);
    return Ok(hashed);
  } catch (e) {
    return Err(makePasswordHashErr(`Failed to hash password: ${String(e)}`));
  }
};

export const verifyPassword = async (plaintext: string, hashed: string): Promise<boolean> => {
  try {
    return await verify(plaintext, hashed);
  } catch {
    return false;
  }
};
