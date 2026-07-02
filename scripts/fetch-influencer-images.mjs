#!/usr/bin/env node
/**
 * Run this on a machine with normal internet access (NOT inside the sandboxed
 * Claude Code cloud session, which has no outbound network access).
 *
 * Usage:
 *   cd mothrpro
 *   node scripts/fetch-influencer-images.mjs            # fill in missing/cartoon images
 *   node scripts/fetch-influencer-images.mjs --force     # also re-check existing http(s) images
 *   node scripts/fetch-influencer-images.mjs --limit=20  # test on first 20 records only
 *
 * For every influencer whose avatar/cover is still the cartoon placeholder
 * (assets/avatar-*.svg / assets/cover-*.svg), it visits their platform pages
 * (YouTube, TikTok, Snapchat, Instagram, X/Twitter — in that order, most
 * scrapable first), grabs the og:image (profile photo) and, for YouTube, the
 * channel banner (used as the cover). Downloaded files are saved under
 * assets/influencers/ and index.html is updated + a backup is written first.
 *
 * Notes:
 *  - Instagram and X/Twitter usually require a login to view a profile, so
 *    they will often fail — that's expected, not a bug. YouTube/TikTok/
 *    Snapchat public pages are much more likely to work.
 *  - This can take a while for 356 records (network-bound). Progress is
 *    checkpointed to index.html every CHECKPOINT_EVERY records, so it's safe
 *    to stop and re-run — already-fixed records are skipped automatically.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');
const IMAGES_DIR = path.join(ROOT, 'assets', 'influencers');
const REPORT_PATH = path.join(IMAGES_DIR, '_report.json');

const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const LIMIT = (() => {
  const a = args.find(x => x.startsWith('--limit='));
  return a ? parseInt(a.split('=')[1], 10) : Infinity;
})();

const CHECKPOINT_EVERY = 15;
const REQUEST_TIMEOUT_MS = 15000;
const DELAY_BETWEEN_REQUESTS_MS = 900;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// Ordered roughly by how likely a public page is to expose an og:image without login.
const PLATFORM_PRIORITY = ['يوتيوب', 'تيك توك', 'سناب شات', 'انستقرام', 'تويتر/X'];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function isCartoon(url) {
  return !url || /^assets\/(avatar|cover)-(male|female|neutral)\.svg$/.test(url);
}

function orderPlatformKeys(platforms) {
  const keys = Object.keys(platforms || {});
  const known = PLATFORM_PRIORITY.filter(k => keys.includes(k));
  const rest = keys.filter(k => !PLATFORM_PRIORITY.includes(k));
  return [...known, ...rest];
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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

async function downloadImage(url, destBasePath) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!ct.startsWith('image/')) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 800) return null; // likely a 1x1 tracking pixel or default placeholder
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[ct] || 'jpg';
    const finalPath = `${destBasePath}.${ext}`;
    fs.writeFileSync(finalPath, buf);
    return finalPath;
  } catch {
    return null;
  }
}

function loadData() {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const m = html.match(/(<script type="application\/json" id="__d__">)([\s\S]*?)(<\/script>)/);
  if (!m) throw new Error('Could not find __d__ data script tag in index.html');
  return { html, prefix: m[1], data: JSON.parse(m[2]), suffix: m[3], matchStart: m.index, matchEnd: m.index + m[0].length };
}

function saveData(original, data) {
  const { html, prefix, suffix, matchStart, matchEnd } = original;
  const blob = JSON.stringify(data, null, 0);
  if (blob.toLowerCase().includes('</script')) throw new Error('Unsafe content in data blob, aborting save');
  const newHtml = html.slice(0, matchStart) + prefix + blob + suffix + html.slice(matchEnd);
  fs.writeFileSync(INDEX_HTML, newHtml, 'utf8');
}

async function main() {
  if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

  const original = loadData();
  const data = original.data;

  if (!fs.existsSync(INDEX_HTML + '.bak')) {
    fs.copyFileSync(INDEX_HTML, INDEX_HTML + '.bak');
    console.log('Backup written to index.html.bak');
  }

  const targets = data.filter(d => FORCE || isCartoon(d.avatar) || isCartoon(d.cover)).slice(0, LIMIT);
  console.log(`${targets.length} / ${data.length} records to process (force=${FORCE})`);

  const report = fs.existsSync(REPORT_PATH) ? JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) : {};
  let changedAvatar = 0, changedCover = 0, processed = 0;

  for (const d of targets) {
    processed++;
    const wantAvatar = FORCE || isCartoon(d.avatar);
    const wantCover = FORCE || isCartoon(d.cover);
    let foundAvatar = null, foundCover = null, source = null;

    for (const key of orderPlatformKeys(d.platforms)) {
      const url = d.platforms[key]?.url;
      if (!url || !/^https?:\/\//i.test(url)) continue;

      const pageHtml = await fetchPage(url);
      if (!pageHtml) continue;

      const imgUrl = extractMetaImage(pageHtml);
      if (!imgUrl) continue;

      if (wantAvatar) {
        const avPath = await downloadImage(imgUrl, path.join(IMAGES_DIR, `${d.id}-avatar`));
        if (avPath) {
          foundAvatar = path.relative(ROOT, avPath).replace(/\\/g, '/');
          source = key;
        }
      }

      if (wantCover) {
        if (key === 'يوتيوب') {
          const bannerUrl = extractYoutubeBanner(pageHtml);
          if (bannerUrl) {
            const cvPath = await downloadImage(bannerUrl, path.join(IMAGES_DIR, `${d.id}-cover`));
            if (cvPath) foundCover = path.relative(ROOT, cvPath).replace(/\\/g, '/');
          }
        }
        if (!foundCover && foundAvatar) {
          // No distinct banner available on this platform; reuse the profile photo as the cover.
          const ext = path.extname(foundAvatar);
          const cvDest = path.join(IMAGES_DIR, `${d.id}-cover${ext}`);
          fs.copyFileSync(path.join(ROOT, foundAvatar), cvDest);
          foundCover = path.relative(ROOT, cvDest).replace(/\\/g, '/');
        }
      }

      if (foundAvatar || foundCover) break; // stop trying other platforms once we got something
      await sleep(DELAY_BETWEEN_REQUESTS_MS);
    }

    if (foundAvatar) { d.avatar = foundAvatar; changedAvatar++; }
    if (foundCover) { d.cover = foundCover; changedCover++; }
    report[d.id] = { name: d.name, source, avatar: foundAvatar || null, cover: foundCover || null };

    const status = `${foundAvatar ? '✅ avatar' : '—'} / ${foundCover ? '✅ cover' : '—'}${source ? ` (${source})` : ''}`;
    console.log(`[${processed}/${targets.length}] ${d.name}: ${status}`);

    if (processed % CHECKPOINT_EVERY === 0) {
      saveData(original, data);
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
      console.log(`--- checkpoint saved (${processed}/${targets.length}) ---`);
    }

    await sleep(DELAY_BETWEEN_REQUESTS_MS);
  }

  saveData(original, data);
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\nDone.');
  console.log(`Avatars found: ${changedAvatar} / ${targets.length}`);
  console.log(`Covers found:  ${changedCover} / ${targets.length}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
  console.log('Records with no real image were left on the cartoon placeholder.');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
