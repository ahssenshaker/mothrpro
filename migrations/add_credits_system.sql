-- Add credits system columns to subscribers table
ALTER TABLE subscribers
  ADD COLUMN IF NOT EXISTS credits_remaining integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unlocked_ids      jsonb   NOT NULL DEFAULT '[]'::jsonb;
