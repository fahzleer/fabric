import { Context, Effect, Layer } from "effect";
import sgMail from "@sendgrid/mail";

export interface EmailMessage {
  readonly to:      string;
  readonly subject: string;
  readonly text:    string;
  readonly html?:   string;
}

export interface EmailAdapterShape {
  readonly send: (msg: EmailMessage) => Effect.Effect<void, never>;
}

export class EmailAdapter extends Context.Tag("@fabric/notification/EmailAdapter")<
  EmailAdapter,
  EmailAdapterShape
>() {
  /** SendGrid implementation — active when SENDGRID_API_KEY is set. */
  static readonly SendGrid: Layer.Layer<EmailAdapter> = Layer.effect(
    EmailAdapter,
    Effect.sync(() => {
      const apiKey = process.env["SENDGRID_API_KEY"];
      const from   = process.env["EMAIL_FROM"] ?? "noreply@fabric.example.com";

      if (apiKey) {
        sgMail.setApiKey(apiKey);
      }

      return {
        send: (msg) =>
          Effect.tryPromise({
            try: async () => {
              if (!apiKey) {
                console.log(`[notification:email] (no SENDGRID_API_KEY) to=${msg.to} subject="${msg.subject}"`);
                return;
              }
              await sgMail.send({ from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
            },
            catch: (e) => e,
          }).pipe(
            Effect.catchAll((e) =>
              Effect.sync(() => console.error("[notification:email] send failed:", e))
            )
          ),
      } satisfies EmailAdapterShape;
    })
  );
}
