# @fabric/firebase — Firebase Client Factory

**Location**: `packages/firebase/src/`

A thin initialization layer that constructs Firebase Admin SDK clients from environment and returns typed singletons. No business logic. No repository logic. Just initialization.

---

## API

```typescript
export interface FirebaseClients {
  db: Database           // Firebase Realtime Database
  storage: Storage | null  // Firebase Storage (null in emulator mode)
  app: App               // The underlying Firebase App (for cleanup)
}

// Primary factory — reads from environment variables
export function createFirebaseFromEnv(): FirebaseClients

// Secondary factory — explicit config (useful in tests)
export function createFirebaseAdmin(config: FirebaseConfig): FirebaseClients

interface FirebaseConfig {
  projectId: string
  databaseURL: string
  storageBucket: string
  serviceAccount?: ServiceAccount  // JSON key file (prod) or undefined (ADC)
}
```

---

## Initialization Logic

```typescript
export function createFirebaseFromEnv(): FirebaseClients {
  // If an App is already initialized, return it
  // (Guards against double initialization in hot-reload scenarios)
  if (getApps().length > 0) {
    const app = getApp()
    return {
      db: getDatabase(app),
      storage: getStorage(app),
      app,
    }
  }

  const config: FirebaseConfig = {
    projectId:   requireEnv("FIREBASE_PROJECT_ID"),
    databaseURL: requireEnv("FIREBASE_DATABASE_URL"),
    storageBucket: requireEnv("FIREBASE_STORAGE_BUCKET"),
    serviceAccount: process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : undefined,
  }

  return createFirebaseAdmin(config)
}
```

**Authentication to Firebase**:
- **Production on GCP**: `FIREBASE_SERVICE_ACCOUNT` is not set. The Admin SDK uses Application Default Credentials (ADC) — the Cloud Function's service account is automatically trusted.
- **Production outside GCP**: `FIREBASE_SERVICE_ACCOUNT` is a JSON service account key stored in GCP Secret Manager, loaded at cold start.
- **Development**: `FIREBASE_DATABASE_URL` points to the Firebase Local Emulator. The Admin SDK bypasses auth for emulator connections.

---

## Usage Pattern

```typescript
// In apps/cf-api/src/index.ts
import { createFirebaseFromEnv } from "@fabric/firebase"

const firebase = createFirebaseFromEnv()
// firebase.db → passed to all repositories
// firebase.app → registered with graceful shutdown handler

registerCleanup("firebase", () => deleteApp(firebase.app))
```

The `FirebaseClients` object is created once at cold start and passed as a constructor argument to every repository that needs it. No globals. No `admin.database()` calls scattered through the codebase.

---

## Why Not Use Firebase Emulator in Tests?

The Free Monad approach in cf-commerce (see [patterns/free-monad-events.md](../patterns/free-monad-events.md)) deliberately separates programs from interpreters so that tests can use an in-memory interpreter instead of Firebase. This means tests in cf-commerce don't need `@fabric/firebase` at all during unit testing.

For integration tests that genuinely need Firebase behavior, the Firebase Local Emulator (`firebase emulators:start`) provides a local RTDB instance. The `FIREBASE_DATABASE_URL` env var points to `http://localhost:9000?ns=project-name` and the Admin SDK detects the emulator automatically.
