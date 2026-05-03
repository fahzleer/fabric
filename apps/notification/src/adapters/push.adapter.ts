import { Context, Effect, Layer } from "effect";
import admin from "firebase-admin";

export interface PushMessage {
  readonly token:   string;
  readonly title:   string;
  readonly body:    string;
  readonly data?:   Record<string, string>;
}

export interface PushAdapterShape {
  readonly send: (msg: PushMessage) => Effect.Effect<void, never>;
}

export class PushAdapter extends Context.Tag("@fabric/notification/PushAdapter")<
  PushAdapter,
  PushAdapterShape
>() {
  /** FCM implementation — active when FIREBASE_SERVICE_ACCOUNT_JSON is set. */
  static readonly FCM: Layer.Layer<PushAdapter> = Layer.effect(
    PushAdapter,
    Effect.sync(() => {
      const serviceAccountJson = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
      let messaging: admin.messaging.Messaging | null = null;

      if (serviceAccountJson) {
        try {
          const serviceAccount = JSON.parse(serviceAccountJson) as admin.ServiceAccount;
          const app = admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
          messaging = app.messaging();
        } catch (e) {
          console.error("[notification:push] FCM init failed:", e);
        }
      }

      return {
        send: (msg) =>
          Effect.tryPromise({
            try: async () => {
              if (!messaging) {
                console.log(`[notification:push] (no FCM creds) token=${msg.token.slice(0, 20)}… title="${msg.title}"`);
                return;
              }
              await messaging.send({
                token:        msg.token,
                notification: { title: msg.title, body: msg.body },
                data:         msg.data,
              });
            },
            catch: (e) => e,
          }).pipe(
            Effect.catchAll((e) =>
              Effect.sync(() => console.error("[notification:push] send failed:", e))
            )
          ),
      } satisfies PushAdapterShape;
    })
  );
}
