#!/usr/bin/env node
/**
 * Run on a machine/CI runner with normal internet access (a real headless
 * browser is required — Instagram/TikTok/X only render their stats via
 * client-side JS).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/update-follower-stats.mjs
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/update-follower-stats.mjs --limit=20
 *
 * Reads influencers from Supabase, scrapes current follower counts from
 * platform pages, then writes updated records back to Supabase.
 * Does NOT touch tier/rank/rangeLabel — those are managed by the admin panel.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'assets', 'influencers', '_stats_report.json');

// ─── Supabase ────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── Config ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const LIMIT = (() => {
  const a = args.find(x => x.startsWith('--limit='));
  return a ? parseInt(a.split('=')[1], 10) : Infinity;
})();

const CHECKPOINT_EVERY = 15;
const NAV_TIMEOUT_MS = 30000;
const SETTLE_MS = 4000;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const SUPPORTED_PLATFORMS = ['يوتيوب', 'تيك توك', 'تويتر/X', 'سناب شات', 'انستقرام'];
const MAX_PLAUSIBLE_FOLLOWERS = 500_000_000;

const URL_BLOCKLIST_PATH = path.join(ROOT, 'assets', 'influencers', '_url_blocklist.json');
const urlBlocklist = fs.existsSync(URL_BLOCKLIST_PATH)
  ? JSON.parse(fs.readFileSync(URL_BLOCKLIST_PATH, 'utf8'))
  : {};
function isBlocked(id, platformKey) {
  return (urlBlocklist[String(id)] || []).includes(platformKey);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function parseCount(str) {
  if (!str) return null;
  const m = str.replace(/,/g, '').match(/^([\d.]+)\s*([KMB])?$/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const suffix = (m[2] || '').toUpperCase();
  if (suffix === 'K') n *= 1_000;
  else if (suffix === 'M') n *= 1_000_000;
  else if (suffix === 'B') n *= 1_000_000_000;
  return Math.round(n);
}

function formatCount(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

async function extractFollowers(page, platformKey) {
  await page.waitForTimeout(SETTLE_MS);

  if (platformKey === 'يوتيوب') {
    const text = (await page.evaluate(() => document.body.innerText)).slice(0, 2000);
    const m = text.match(/([\d.,]+\s?[KMB]?)\s*subscribers/i);
    return m ? parseCount(m[1].trim()) : null;
  }

  if (platformKey === 'تيك توك') {
    const el = await page.$('[data-e2e="followers-count"]');
    if (!el) return null;
    return parseCount((await el.textContent()).trim());
  }

  if (platformKey === 'تويتر/X') {
    const text = await page.evaluate(() => document.body.innerText);
    const m = text.match(/([\d.,]+\s?[KMB]?)\s*Followers/i);
    return m ? parseCount(m[1].trim()) : null;
  }

  if (platformKey === 'سناب شات') {
    const lines = (await page.evaluate(() => document.body.innerText)).split('\n').slice(0, 30);
    for (const line of lines) {
      const m = line.match(/^\s*([\d.,]+\s?[KMB]?)\s*followers\b/i);
      if (m) return parseCount(m[1].trim());
    }
    return null;
  }

  if (platformKey === 'انستقرام') {
    // Try og:description meta tag first — available before login wall intercepts
    const metaContent = await page.evaluate(() => {
      const el = document.querySelector('meta[property="og:description"]');
      return el ? el.getAttribute('content') : null;
    });
    if (metaContent) {
      // Format: "1.2M Followers, 500 Following, 200 Posts"
      const m = metaContent.match(/([\d.,]+\s?[KMB]?)\s*[Ff]ollowers/);
      if (m) return parseCount(m[1].trim());
    }
    // Fallback: scan visible page text
    const text = await page.evaluate(() => document.body.innerText);
    const m = text.match(/([\d.,]+\s?[KMB]?)\s*[Ff]ollowers/);
    return m ? parseCount(m[1].trim()) : null;
  }

  return null;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function loadData() {
  const { data, error } = await supa
    .from('influencers')
    .select('*')
    .order('rank', { ascending: true });
  if (error) throw new Error('Failed to load from Supabase: ' + error.message);
  return data;
}

async function saveRecords(records) {
  if (!records.length) return;
  const { error } = await supa.from('influencers').upsert(records, { onConflict: 'id' });
  if (error) throw new Error('Failed to upsert to Supabase: ' + error.message);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📥 Loading influencers from Supabase...');
  const data = await loadData();
  console.log(`Loaded ${data.length} records`);

  const targets = data
    .filter(d => SUPPORTED_PLATFORMS.some(p => d.platforms?.[p]?.url))
    .slice(0, LIMIT);
  console.log(`${targets.length} / ${data.length} records have at least one supported platform`);

  const browser = await chromium.launch();
  const report = fs.existsSync(REPORT_PATH) ? JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) : {};

  let processed = 0, updatedRecords = 0;
  const pendingUpsert = [];

  for (const d of targets) {
    processed++;
    let anyUpdated = false;
    const perPlatform = {};

    for (const key of SUPPORTED_PLATFORMS) {
      if (isBlocked(d.id, key)) continue;
      const url = d.platforms?.[key]?.url;
      if (!url || !/^https?:\/\//i.test(url)) continue;

      const page = await browser.newPage({ viewport: { width: 500, height: 1000 }, userAgent: UA });
      let count = null;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
        count = await extractFollowers(page, key);
      } catch {
        // leave count null on any failure
      } finally {
        await page.close();
      }

      if (count && count > 0 && count <= MAX_PLAUSIBLE_FOLLOWERS) {
        d.platforms[key].followersNum = count;
        d.platforms[key].followers = formatCount(count);
        perPlatform[key] = count;
        anyUpdated = true;
      }
    }

    if (anyUpdated) {
      const total = Object.values(d.platforms).reduce((sum, p) => sum + (Number(p.followersNum) || 0), 0);
      d.totalFollowers = total;
      d.totalFormatted = formatCount(total);
      updatedRecords++;
      pendingUpsert.push(d);
    }

    report[d.id] = { name: d.name, updated: perPlatform, totalFollowers: d.totalFollowers };
    console.log(`[${processed}/${targets.length}] ${d.name}: ${anyUpdated ? '✅ ' + JSON.stringify(perPlatform) : '—'}`);

    if (processed % CHECKPOINT_EVERY === 0 && pendingUpsert.length) {
      await saveRecords([...pendingUpsert]);
      pendingUpsert.length = 0;
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
      console.log(`--- checkpoint saved (${processed}/${targets.length}) ---`);
    }
  }

  await browser.close();

  if (pendingUpsert.length) await saveRecords(pendingUpsert);
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\nDone.');
  console.log(`Records with at least one updated platform: ${updatedRecords} / ${targets.length}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
