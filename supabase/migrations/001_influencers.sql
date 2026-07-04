-- ═══════════════════════════════════════════════════════════════
-- Influencers table
-- All access goes through /api/influencers (service role only).
-- Direct client-side reads are blocked by RLS.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.influencers (
  id              bigint      primary key,
  name            text        not null,
  nickname        text        default '',
  specialization  text        default '',
  intro           text        default '',
  gender          text        default '',
  avatar          text        default '',
  cover           text        default '',
  platforms       jsonb       default '{}',
  categories      text[]      default '{}',
  tags            text[]      default '{}',
  regions         text[]      default '{}',
  "followersAges"    text[]   default '{}',
  "followersGender"  numeric  default 0,
  tier            text        default '',
  rank            integer     default 0,
  "rangeLabel"    text        default '',
  "totalFollowers" bigint     default 0,
  "totalFormatted" text       default '',
  source          text        default 'verified',
  "sourceNote"    text        default '',
  "isManuallyAdded" boolean   default false,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Block all direct client access — only the server-side API
-- (which uses the service key) can read or write this table.
alter table public.influencers enable row level security;

create policy "service_role_only" on public.influencers
  for all
  using (auth.role() = 'service_role');
