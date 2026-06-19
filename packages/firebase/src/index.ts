import { Ok, type Result, type TaggedError, isErr } from "@fabric/types";
import { type App, type Credential, cert, getApps, initializeApp } from "firebase-admin/app";
import { type Database, getDatabase } from "firebase-admin/database";
import { type Storage, getStorage } from "firebase-admin/storage";

export type FirebaseInitError = TaggedError<"FirebaseInitError">;

const firebaseInitError = (message: string): FirebaseInitError => ({
  _tag: "FirebaseInitError",
  message,
});

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
  try {
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

    return Ok(_clients);
  } catch (cause) {
    return { _tag: "Err", error: firebaseInitError(String(cause)) };
  }
}

export function createFirebaseFromEnv(): Result<FirebaseClients, FirebaseInitError> {
  if (getApps().length > 0 && _clients !== undefined) {
    return Ok(_clients);
  }

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? (JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT) as object)
      : undefined;

    const result = createFirebaseAdmin({
      projectId: process.env.FIREBASE_PROJECT_ID ?? process.env.GCP_PROJECT_ID ?? "",
      databaseURL: process.env.FIREBASE_DATABASE_URL ?? process.env.RTDB_URL ?? "",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? process.env.GCS_BUCKET ?? "",
      ...(serviceAccount !== undefined && { serviceAccount }),
    });

    if (isErr(result)) {
      // Preserve the typed FirebaseInitError from the inner call.
      return result;
    }
    return Ok(result.value);
  } catch (cause) {
    return { _tag: "Err", error: firebaseInitError(String(cause)) };
  }
}

export * from "./schema-types.js";
