import { Context, Effect, Layer } from "effect";
import twilio from "twilio";

export interface SmsMessage {
  readonly to:   string;
  readonly body: string;
}

export interface SmsAdapterShape {
  readonly send: (msg: SmsMessage) => Effect.Effect<void, never>;
}

export class SmsAdapter extends Context.Tag("@fabric/notification/SmsAdapter")<
  SmsAdapter,
  SmsAdapterShape
>() {
  /** Twilio implementation — active when TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN are set. */
  static readonly Twilio: Layer.Layer<SmsAdapter> = Layer.effect(
    SmsAdapter,
    Effect.sync(() => {
      const accountSid = process.env["TWILIO_ACCOUNT_SID"];
      const authToken  = process.env["TWILIO_AUTH_TOKEN"];
      const from       = process.env["TWILIO_PHONE_NUMBER"] ?? "";

      const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

      return {
        send: (msg) =>
          Effect.tryPromise({
            try: async () => {
              if (!client) {
                console.log(`[notification:sms] (no Twilio creds) to=${msg.to} body="${msg.body}"`);
                return;
              }
              await client.messages.create({ to: msg.to, from, body: msg.body });
            },
            catch: (e) => e,
          }).pipe(
            Effect.catchAll((e) =>
              Effect.sync(() => console.error("[notification:sms] send failed:", e))
            )
          ),
      } satisfies SmsAdapterShape;
    })
  );
}
