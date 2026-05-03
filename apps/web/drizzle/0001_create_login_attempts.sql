CREATE TABLE IF NOT EXISTS login_attempts (
  email            TEXT PRIMARY KEY,
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  first_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL,
  locked_until     TIMESTAMP WITH TIME ZONE,
  updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_locked_until
  ON login_attempts (locked_until)
  WHERE locked_until IS NOT NULL;
