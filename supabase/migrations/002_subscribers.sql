-- Subscribers table: maps auth users to their subscription plan.
-- Rows are created by registerUserIfNew() on first login and managed by the
-- webhook handler and activate.js API route. Direct client writes are blocked
-- by the RLS policies below — all mutations must go through service_role.

CREATE TABLE IF NOT EXISTS subscribers (
  id           uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        text        NOT NULL,
  plan         text        NOT NULL DEFAULT 'free'
                           CHECK (plan IN ('free', 'pro', 'pending', 'admin')),
  activated_at timestamptz,
  expires_at   timestamptz  -- NULL = permanent; non-NULL = trial/expiring subscription
);

CREATE INDEX IF NOT EXISTS subscribers_email_idx ON subscribers (email);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read their own row only.
CREATE POLICY "subscribers: users read own row"
  ON subscribers FOR SELECT
  USING (auth.uid() = id);

-- All writes (INSERT / UPDATE / DELETE) are blocked for non-service_role callers.
-- The webhook handler and activate.js use SUPABASE_SERVICE_KEY which bypasses RLS.
CREATE POLICY "subscribers: no direct writes"
  ON subscribers FOR ALL
  USING (false)
  WITH CHECK (false);
