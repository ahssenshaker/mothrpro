#!/usr/bin/env node
/**
 * Fix wrong URL suspects in the influencer dataset.
 *
 * Two actions:
 *  1. Verified correct URLs (from _url_candidates_report.json, followers >= 100K):
 *     → Update the platform URL in Supabase and remove from blocklist.
 *  2. All remaining wrong URL platforms (not yet fixed):
 *     → Add to _url_blocklist.json to prevent the scraper from
 *       overwriting good stored counts with tiny wrong-URL counts.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/fix-wrong-urls.mjs
 *   Add --dry-run to preview without applying changes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets', 'influencers');

const WRONG_SUSPECTS_PATH    = path.join(ASSETS, '_wrong_url_suspects.json');
const CANDIDATES_REPORT_PATH = path.join(ASSETS, '_url_candidates_report.json');
const CANDIDATES_PATH        = path.join(ASSETS, '_url_candidates.json');
const BLOCKLIST_PATH         = path.join(ASSETS, '_url_blocklist.json');
const FIX_REPORT_PATH        = path.join(ASSETS, '_fix_report.json');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const DRY_RUN = process.argv.includes('--dry-run');

// Only treat a candidate URL as verified if it scraped this many followers or more.
const MIN_VERIFIED_FOLLOWERS = 100_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCount(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function loadJson(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌  Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const wrongSuspects      = loadJson(WRONG_SUSPECTS_PATH) ?? [];
  const candidatesReport   = loadJson(CANDIDATES_REPORT_PATH) ?? {};
  const candidatesUrls     = loadJson(CANDIDATES_PATH) ?? {};
  const blocklist          = loadJson(BLOCKLIST_PATH) ?? {};

  if (DRY_RUN) console.log('🔍  DRY RUN — no changes will be written.\n');

  // ── Build map of verified correct URLs keyed by Supabase ID ─────────────────
  // { supabaseId → { platform → { url, followers } } }
  const verifiedById = {};
  for (const [id, platforms] of Object.entries(candidatesReport)) {
    for (const [platform, result] of Object.entries(platforms)) {
      if ((result.followers ?? 0) >= MIN_VERIFIED_FOLLOWERS) {
        const url = candidatesUrls[id]?.[platform] ?? result.url;
        if (!verifiedById[id]) verifiedById[id] = {};
        verifiedById[id][platform] = { url, followers: result.followers };
      }
    }
  }

  // ── Load all influencers from Supabase ────────────────────────────────────────
  console.log('📥  Loading influencers from Supabase…');
  const { data: influencers, error: loadErr } = await supa
    .from('influencers')
    .select('id, name, platforms, "totalFollowers", "totalFormatted"');
  if (loadErr) throw new Error('Load failed: ' + loadErr.message);
  console.log(`    Loaded ${influencers.length} records.\n`);

  // Build lookup maps
  const byId   = Object.fromEntries(influencers.map(r => [String(r.id), r]));
  const byName = {};
  for (const r of influencers) {
    byName[r.name] = r; // last one wins if duplicates exist
  }

  const updatedBlocklist = structuredClone(blocklist);
  const report = { urlsUpdated: [], blocklisted: [], alreadyBlocked: [], notFound: [] };
  const supabaseUpserts = [];

  // ── Step 1: Apply verified correct URLs ──────────────────────────────────────
  console.log('🔧  Applying verified correct URLs…');
  for (const [supabaseId, platforms] of Object.entries(verifiedById)) {
    const rec = byId[supabaseId];
    if (!rec) {
      console.warn(`   ⚠️  ID ${supabaseId} not found in Supabase`);
      continue;
    }

    const updatedPlatforms = structuredClone(rec.platforms ?? {});
    let changed = false;

    for (const [platform, { url, followers }] of Object.entries(platforms)) {
      const current = updatedPlatforms[platform]?.url;
      if (current === url) {
        console.log(`   ✓ ${rec.name} | ${platform}: URL already correct`);
        continue;
      }

      updatedPlatforms[platform] = {
        ...(updatedPlatforms[platform] ?? {}),
        url,
        followersNum: followers,
        followers: formatCount(followers),
      };
      changed = true;

      console.log(`   🔧 ${rec.name} | ${platform}`);
      console.log(`      ${current ?? '(none)'} → ${url}  (${formatCount(followers)})`);
      report.urlsUpdated.push({
        name: rec.name, id: supabaseId, platform,
        oldUrl: current ?? null, newUrl: url, followers,
      });

      // Remove from blocklist — URL is now correct, scraping can resume.
      if (updatedBlocklist[supabaseId]) {
        updatedBlocklist[supabaseId] = updatedBlocklist[supabaseId].filter(p => p !== platform);
        if (updatedBlocklist[supabaseId].length === 0) delete updatedBlocklist[supabaseId];
      }
    }

    if (changed) {
      const total = Object.values(updatedPlatforms)
        .reduce((s, p) => s + (Number(p.followersNum) || 0), 0);
      supabaseUpserts.push({
        ...rec,
        platforms: updatedPlatforms,
        totalFollowers: total,
        totalFormatted: formatCount(total),
      });
    }
  }

  if (supabaseUpserts.length && !DRY_RUN) {
    const { error: upsertErr } = await supa
      .from('influencers')
      .upsert(supabaseUpserts, { onConflict: 'id' });
    if (upsertErr) throw new Error('Upsert failed: ' + upsertErr.message);
    console.log(`\n   💾 ${supabaseUpserts.length} record(s) updated in Supabase.`);
  }

  // ── Step 2: Blocklist all remaining wrong URL platforms ───────────────────────
  console.log('\n🚫  Ensuring wrong URL platforms are blocklisted…');
  for (const suspect of wrongSuspects) {
    const rec = byName[suspect.name];
    if (!rec) {
      console.warn(`   ⚠️  Not found in Supabase: "${suspect.name}"`);
      report.notFound.push({ name: suspect.name, platform: suspect.platform });
      continue;
    }

    const id       = String(rec.id);
    const platform = suspect.platform;

    // Skip if this platform was just corrected with a verified URL.
    const wasFixed = report.urlsUpdated.some(u => u.id === id && u.platform === platform);
    if (wasFixed) continue;

    const already = (updatedBlocklist[id] ?? []).includes(platform);
    if (already) {
      console.log(`   ✓ Already blocked: ${suspect.name} | ${platform}`);
      report.alreadyBlocked.push({ name: suspect.name, id, platform });
    } else {
      if (!updatedBlocklist[id]) updatedBlocklist[id] = [];
      updatedBlocklist[id].push(platform);
      console.log(`   🚫 Blocking: ${suspect.name} | ${platform}`);
      report.blocklisted.push({ name: suspect.name, id, platform });
    }
  }

  // ── Save blocklist ────────────────────────────────────────────────────────────
  if (!DRY_RUN) {
    fs.writeFileSync(BLOCKLIST_PATH, JSON.stringify(updatedBlocklist, null, 2));
    console.log(`\n💾  Blocklist saved → ${path.relative(ROOT, BLOCKLIST_PATH)}`);
  }

  // ── Save report ───────────────────────────────────────────────────────────────
  fs.writeFileSync(FIX_REPORT_PATH, JSON.stringify(report, null, 2));

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`✅  URLs corrected in Supabase : ${report.urlsUpdated.length}`);
  console.log(`🚫  Newly blocklisted platforms: ${report.blocklisted.length}`);
  console.log(`✓   Already blocked            : ${report.alreadyBlocked.length}`);
  if (report.notFound.length) {
    console.log(`⚠️   Not found in DB           : ${report.notFound.length}`);
    report.notFound.forEach(n => console.log(`     – ${n.name} | ${n.platform}`));
  }
  if (DRY_RUN) console.log('\n[DRY RUN — no changes were applied]');
  console.log(`\n📄  Report → ${path.relative(ROOT, FIX_REPORT_PATH)}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
