import type { PasswordHashError, Result } from "@fabric/types";
import { Err, Ok, PasswordHashError as makePasswordHashErr } from "@fabric/types";
import { hash, compare as verify } from "bcryptjs";

const BCRYPT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10);

export const hashPassword = async (
  plaintext: string
): Promise<Result<string, PasswordHashError>> => {
  try {
    const hashed = await hash(plaintext, BCRYPT_ROUNDS);
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
