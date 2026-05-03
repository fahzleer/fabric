export {
  buildKeySetFromSingleKey,
  generateKeyHex,
  getValidKeyHexes,
  rotateKeySet,
} from "./paseto/key-manager";
export type { PasetoKey, PasetoKeySet } from "./paseto/key-manager";

export { requireAuth, requireRole } from "./middleware";
