import { Result, TaggedError } from "better-result";
import { type App, type Credential, cert, getApps, initializeApp } from "firebase-admin/app";
import { type Database, getDatabase } from "firebase-admin/database";
import { type Storage, getStorage } from "firebase-admin/storage";

export class FirebaseInitError extends TaggedError("FirebaseInitError")<{ message: string }>() {}

const emulatorCredential: Credential = {
  getAccessToken: () => Promise.resolve({ access_token: "owner", expires_in: 3600 }),
};

export type { Database, Storage };

export interface FirebaseConfig {
  projectId: string;
  databaseURL: string;
  storageBucket: string;
  serviceAccount?: object;
}

export interface FirebaseClients {
  db: Database;
  storage: Storage | null;
  app: App;
}

let _app: App | undefined;
let _clients: FirebaseClients | undefined;

export function createFirebaseAdmin(
  config: FirebaseConfig
): Result<FirebaseClients, FirebaseInitError> {
  return Result.try({
    try: () => {
      if (_app === undefined) {
        const credential: Credential | undefined = config.serviceAccount
          ? cert(config.serviceAccount as Parameters<typeof cert>[0])
          : process.env.FIREBASE_DATABASE_EMULATOR_HOST
            ? emulatorCredential
            : undefined;

        _app = initializeApp({
          projectId: config.projectId,
          ...(credential !== undefined && { credential }),
          databaseURL: config.databaseURL,
          storageBucket: config.storageBucket,
        });
      }

      if (_clients === undefined) {
        const isEmulator = !!process.env.FIREBASE_DATABASE_EMULATOR_HOST;

        _clients = {
          app: _app,
          db: getDatabase(_app),
          storage: isEmulator ? null : getStorage(_app),
        };
      }

      return _clients;
    },
    catch: (e) => new FirebaseInitError({ message: String(e) }),
  });
}

export function createFirebaseFromEnv(): Result<FirebaseClients, FirebaseInitError> {
  if (getApps().length > 0 && _clients !== undefined) {
    return Result.ok(_clients);
  }

  return Result.try({
    try: () => {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? (JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as object)
        : undefined;

      const result = createFirebaseAdmin({
        projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.GCP_PROJECT_ID ?? "",
        databaseURL: process.env.FIREBASE_DATABASE_URL ?? process.env.RTDB_URL ?? "",
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? process.env.GCS_BUCKET ?? "",
        ...(serviceAccount !== undefined && { serviceAccount }),
      });

      if (Result.isError(result)) {
        throw result.error;
      }

      return result.value;
    },
    catch: (e) =>
      e instanceof FirebaseInitError ? e : new FirebaseInitError({ message: String(e) }),
  });
}

export * from "./schema-types.js";
