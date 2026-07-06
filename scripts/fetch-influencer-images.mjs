#!/usr/bin/env node
/**
 * Run this on a machine with normal internet access. Requires Playwright with
 * Chromium installed (`npx playwright install chromium`).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/fetch-influencer-images.mjs
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/fetch-influencer-images.mjs --force
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/fetch-influencer-images.mjs --limit=20
 *
 * For every influencer whose avatar/cover is still the cartoon placeholder,
 * opens platform pages in a real headless browser and downloads a real photo.
 * Saves image files to assets/influencers/ and updates the record in Supabase.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IMAGES_DIR = path.join(ROOT, 'assets', 'influencers');
const REPORT_PATH = path.join(IMAGES_DIR, '_report.json');
const HASH_REGISTRY_PATH = path.join(IMAGES_DIR, '_image_hashes.json');

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
const FORCE = args.includes('--force');
const LIMIT = (() => {
  const a = args.find(x => x.startsWith('--limit='));
  return a ? parseInt(a.split('=')[1], 10) : Infinity;
})();

const CHECKPOINT_EVERY = 15;
const NAV_TIMEOUT_MS = 30000;
const DOWNLOAD_TIMEOUT_MS = 15000;
const SETTLE_MS = 3500;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PLATFORM_PRIORITY = ['يوتيوب', 'تيك توك', 'سناب شات', 'تويتر/X'];

const KNOWN_GENERIC_IMAGE_HASHES = new Set([
  '66825c1cd05d51a3fc20e564e4b0b382',
  '6f0f96ef54c421074895bb65722eafe7',
]);
const seenImageHashes = new Map(
  fs.existsSync(HASH_REGISTRY_PATH)
    ? Object.entries(JSON.parse(fs.readFileSync(HASH_REGISTRY_PATH, 'utf8')))
    : []
);
function saveHashRegistry() {
  fs.writeFileSync(HASH_REGISTRY_PATH, JSON.stringify(Object.fromEntries(seenImageHashes), null, 2));
}

const URL_BLOCKLIST_PATH = path.join(IMAGES_DIR, '_url_blocklist.json');
const urlBlocklist = fs.existsSync(URL_BLOCKLIST_PATH)
  ? JSON.parse(fs.readFileSync(URL_BLOCKLIST_PATH, 'utf8'))
  : {};
function isBlocked(id, platformKey) {
  return (urlBlocklist[String(id)] || []).includes(platformKey);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isCartoon(url) {
  return !url || /^assets\/(avatar|cover)-(male|female|neutral)\.svg$/.test(url);
}

function orderPlatformKeys(platforms) {
  const keys = Object.keys(platforms || {});
  const known = PLATFORM_PRIORITY.filter(k => keys.includes(k));
  const rest = keys.filter(k => !PLATFORM_PRIORITY.includes(k) && k !== 'انستقرام');
  return [...known, ...rest];
}

function extractMetaImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1].replace(/&amp;/g, '&');
  }
  return null;
}

function extractYoutubeBanner(html) {
  const m = html.match(/"banner":\s*\{\s*"thumbnails":\s*(\[[^\]]*\])/);
  if (!m) return null;
  try {
    const arr = JSON.parse(m[1]);
    if (Array.isArray(arr) && arr.length) return arr[arr.length - 1].url;
  } catch {}
  return null;
}

async function extractImages(page, url, platformKey) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  } catch {
    return { avatarUrl: null, coverUrl: null };
  }
  await page.waitForTimeout(SETTLE_MS);

  const html = await page.content();
  let avatarUrl = extractMetaImage(html);
  let coverUrl = null;

  if (platformKey === 'يوتيوب') {
    coverUrl = extractYoutubeBanner(html);
  } else if (platformKey === 'تيك توك' && !avatarUrl) {
    avatarUrl = await page.evaluate(() => {
      const el = document.querySelector('[data-e2e="user-avatar"] img') || document.querySelector('span[class*="AvatarLarge"] img');
      return el ? el.src : null;
    }).catch(() => null);
  } else if (platformKey === 'تويتر/X') {
    const imgSrcs = await page.evaluate(() => Array.from(document.querySelectorAll('img')).map(img => img.src)).catch(() => []);
    if (!avatarUrl) avatarUrl = imgSrcs.find(src => /profile_images/.test(src)) || null;
    coverUrl = imgSrcs.find(src => /profile_banners/.test(src)) || null;
  }

  return { avatarUrl, coverUrl };
}

async function downloadImage(url, destBasePath, influencerId) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 800) return null;

    const hash = crypto.createHash('md5').update(buf).digest('hex');
    if (KNOWN_GENERIC_IMAGE_HASHES.has(hash)) return null;
    const owner = seenImageHashes.get(hash);
    if (owner !== undefined && owner !== influencerId) return null;
    seenImageHashes.set(hash, influencerId);

    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[ct] || 'jpg';
    const finalPath = `${destBasePath}.${ext}`;
    fs.writeFileSync(finalPath, buf);
    return finalPath;
  } catch {
    return null;
  }
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
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  console.log('📥 Loading influencers from Supabase...');
  const data = await loadData();
  console.log(`Loaded ${data.length} records`);

  const targets = data
    .filter(d => FORCE || isCartoon(d.avatar) || isCartoon(d.cover))
    .slice(0, LIMIT);
  console.log(`${targets.length} / ${data.length} records to process (force=${FORCE})`);

  const browser = await chromium.launch();
  const report = fs.existsSync(REPORT_PATH) ? JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) : {};
  let changedAvatar = 0, changedCover = 0, processed = 0;
  const pendingUpsert = [];

  for (const d of targets) {
    processed++;
    const wantAvatar = FORCE || isCartoon(d.avatar);
    const wantCover = FORCE || isCartoon(d.cover);
    let foundAvatar = null, foundCover = null, source = null;

    for (const key of orderPlatformKeys(d.platforms)) {
      if (isBlocked(d.id, key)) continue;
      const url = d.platforms[key]?.url;
      if (!url || !/^https?:\/\//i.test(url)) continue;

      const page = await browser.newPage({ viewport: { width: 500, height: 1000 }, userAgent: UA });
      let images;
      try {
        images = await extractImages(page, url, key);
      } finally {
        await page.close();
      }

      if (wantAvatar && images.avatarUrl) {
        const avPath = await downloadImage(images.avatarUrl, path.join(IMAGES_DIR, `${d.id}-avatar`), d.id);
        if (avPath) {
          foundAvatar = path.relative(ROOT, avPath).replace(/\\/g, '/');
          source = key;
        }
      }

      if (wantCover) {
        if (images.coverUrl) {
          const cvPath = await downloadImage(images.coverUrl, path.join(IMAGES_DIR, `${d.id}-cover`), d.id);
          if (cvPath) foundCover = path.relative(ROOT, cvPath).replace(/\\/g, '/');
        }
        if (!foundCover && foundAvatar) {
          const ext = path.extname(foundAvatar);
          const cvDest = path.join(IMAGES_DIR, `${d.id}-cover${ext}`);
          fs.copyFileSync(path.join(ROOT, foundAvatar), cvDest);
          foundCover = path.relative(ROOT, cvDest).replace(/\\/g, '/');
        }
      }

      if (foundAvatar || foundCover) break;
    }

    if (foundAvatar) { d.avatar = foundAvatar; changedAvatar++; }
    if (foundCover) { d.cover = foundCover; changedCover++; }
    report[d.id] = { name: d.name, source, avatar: foundAvatar || null, cover: foundCover || null };

    if (foundAvatar || foundCover) pendingUpsert.push(d);

    const status = `${foundAvatar ? '✅ avatar' : '—'} / ${foundCover ? '✅ cover' : '—'}${source ? ` (${source})` : ''}`;
    console.log(`[${processed}/${targets.length}] ${d.name}: ${status}`);

    if (processed % CHECKPOINT_EVERY === 0 && pendingUpsert.length) {
      await saveRecords([...pendingUpsert]);
      pendingUpsert.length = 0;
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
      saveHashRegistry();
      console.log(`--- checkpoint saved (${processed}/${targets.length}) ---`);
    }
  }

  await browser.close();
  if (pendingUpsert.length) await saveRecords(pendingUpsert);
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  saveHashRegistry();

  console.log('\nDone.');
  console.log(`Avatars found: ${changedAvatar} / ${targets.length}`);
  console.log(`Covers found:  ${changedCover} / ${targets.length}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
