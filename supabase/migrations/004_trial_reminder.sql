-- Tracks when a trial-expiry reminder email was last sent to a subscriber.
-- NULL = no reminder sent yet. Set by /api/trial-reminder cron after each send.
-- Reset to NULL automatically when a new trial is granted (grant-trial action).

ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
