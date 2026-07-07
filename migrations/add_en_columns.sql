-- Run this in Supabase SQL Editor
-- Adds English translation columns to the influencers table

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS name_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS specialization_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS intro_en text DEFAULT '',
  ADD COLUMN IF NOT EXISTS categories_en jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tags_en jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS regions_en jsonb DEFAULT '[]';
