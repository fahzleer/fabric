import { describe, expect, test } from "bun:test";
import { type } from "arktype";
import { Result } from "better-result";
import { EnvValidationError, parseEnv, pasetoKey, portNumber, positiveInt } from "./env";

describe("parseEnv", () => {
  test("returns Ok when schema matches", () => {
    const schema = type({ FOO: "string", BAR: "string" });
    const out = parseEnv(schema, { FOO: "a", BAR: "b" });
    expect(Result.isOk(out)).toBe(true);
    if (Result.isOk(out)) {
      expect(out.value.FOO).toBe("a");
      expect(out.value.BAR).toBe("b");
    }
  });

  test("returns Err with summary on missing key", () => {
    const schema = type({ FOO: "string" });
    const out = parseEnv(schema, {});
    expect(Result.isError(out)).toBe(true);
    if (Result.isError(out)) {
      expect(out.error).toBeInstanceOf(EnvValidationError);
      expect(out.error.issues.length).toBeGreaterThan(0);
    }
  });
});

describe("pasetoKey validator", () => {
  test("accepts 64-char hex", () => {
    const schema = type({ KEY: pasetoKey });
    const out = parseEnv(schema, { KEY: "a".repeat(64) });
    expect(Result.isOk(out)).toBe(true);
  });

  test("rejects short key", () => {
    const schema = type({ KEY: pasetoKey });
    const out = parseEnv(schema, { KEY: "abc" });
    expect(Result.isError(out)).toBe(true);
  });

  test("rejects non-hex", () => {
    const schema = type({ KEY: pasetoKey });
    const out = parseEnv(schema, { KEY: "z".repeat(64) });
    expect(Result.isError(out)).toBe(true);
  });
});

describe("portNumber validator", () => {
  test("parses valid port string into number", () => {
    const schema = type({ PORT: portNumber });
    const out = parseEnv(schema, { PORT: "3010" });
    expect(Result.isOk(out)).toBe(true);
    if (Result.isOk(out)) expect(out.value.PORT).toBe(3010);
  });

  test("rejects port > 65535", () => {
    const schema = type({ PORT: portNumber });
    const out = parseEnv(schema, { PORT: "99999" });
    expect(Result.isError(out)).toBe(true);
  });

  test("rejects non-numeric", () => {
    const schema = type({ PORT: portNumber });
    const out = parseEnv(schema, { PORT: "abc" });
    expect(Result.isError(out)).toBe(true);
  });
});

describe("positiveInt validator", () => {
  test("parses positive integer", () => {
    const schema = type({ N: positiveInt });
    const out = parseEnv(schema, { N: "42" });
    expect(Result.isOk(out)).toBe(true);
    if (Result.isOk(out)) expect(out.value.N).toBe(42);
  });

  test("rejects zero", () => {
    const schema = type({ N: positiveInt });
    const out = parseEnv(schema, { N: "0" });
    expect(Result.isError(out)).toBe(true);
  });

  test("rejects negative", () => {
    const schema = type({ N: positiveInt });
    const out = parseEnv(schema, { N: "-5" });
    expect(Result.isError(out)).toBe(true);
  });
});
