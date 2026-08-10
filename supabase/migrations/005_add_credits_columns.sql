-- Reconciles this repo's schema with production: the live subscribers table
-- already has a 'credits' plan (per-influencer-unlock tier) and the columns
-- below, applied directly against Supabase outside of this migration history.
-- Safe to re-run: IF NOT EXISTS / constraint replace are both idempotent.

ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS credits_remaining integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unlocked_ids      jsonb   DEFAULT '[]';

ALTER TABLE public.subscribers DROP CONSTRAINT IF EXISTS subscribers_plan_check;
ALTER TABLE public.subscribers ADD CONSTRAINT subscribers_plan_check
  CHECK (plan IN ('free', 'pro', 'pending', 'admin', 'credits'));
