CREATE TABLE IF NOT EXISTS "user" (
  "id"              text PRIMARY KEY,
  "name"            text NOT NULL,
  "email"           text NOT NULL UNIQUE,
  "email_verified"  boolean NOT NULL DEFAULT false,
  "image"           text,
  "role"            text NOT NULL DEFAULT 'customer',
  "banned"          boolean DEFAULT false,
  "ban_reason"      text,
  "ban_expires"     timestamp with time zone,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"              text PRIMARY KEY,
  "expires_at"      timestamp with time zone NOT NULL,
  "token"           text NOT NULL UNIQUE,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "ip_address"      text,
  "user_agent"      text,
  "user_id"         text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "impersonated_by" text
);

CREATE TABLE IF NOT EXISTS "account" (
  "id"                       text PRIMARY KEY,
  "account_id"               text NOT NULL,
  "provider_id"              text NOT NULL,
  "user_id"                  text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token"             text,
  "refresh_token"            text,
  "id_token"                 text,
  "access_token_expires_at"  timestamp with time zone,
  "refresh_token_expires_at" timestamp with time zone,
  "scope"                    text,
  "password"                 text,
  "created_at"               timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"               timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id"          text PRIMARY KEY,
  "identifier"  text NOT NULL,
  "value"       text NOT NULL,
  "expires_at"  timestamp with time zone NOT NULL,
  "created_at"  timestamp with time zone DEFAULT now(),
  "updated_at"  timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_session_user_id"          ON "session"("user_id");
CREATE INDEX IF NOT EXISTS "idx_session_token"            ON "session"("token");
CREATE INDEX IF NOT EXISTS "idx_account_user_id"          ON "account"("user_id");
CREATE INDEX IF NOT EXISTS "idx_verification_identifier"  ON "verification"("identifier");
CREATE INDEX IF NOT EXISTS "idx_user_email"               ON "user"("email");
CREATE INDEX IF NOT EXISTS "idx_user_role"                ON "user"("role");
