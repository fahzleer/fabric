export interface PasetoKey {
  keyId: string;
  keyHex: string;
  createdAt: string;
}

export interface PasetoKeySet {
  current: PasetoKey;
  previous?: PasetoKey & { expiresAt: string };
}

export function generateKeyHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("hex");
}

export function buildKeySetFromSingleKey(keyHex: string): PasetoKeySet {
  return {
    current: {
      keyId: "primary",
      keyHex: keyHex.trim().toLowerCase(),
      createdAt: new Date().toISOString(),
    },
  };
}

export function rotateKeySet(existing: PasetoKeySet, newKeyHex: string): PasetoKeySet {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);
  return {
    current: {
      keyId: crypto.randomUUID(),
      keyHex: newKeyHex.trim().toLowerCase(),
      createdAt: now.toISOString(),
    },
    previous: {
      ...existing.current,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

export function getValidKeyHexes(keySet: PasetoKeySet): string[] {
  const now = new Date();
  const keys = [keySet.current.keyHex];
  if (
    keySet.previous &&
    new Date(keySet.previous.expiresAt) > now
  ) {
    keys.push(keySet.previous.keyHex);
  }
  return keys;
}
