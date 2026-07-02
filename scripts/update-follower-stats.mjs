#!/usr/bin/env node
/**
 * Run on a machine/CI runner with normal internet access (a real headless
 * browser, not a plain HTTP fetch, is required — Instagram/TikTok/X only
 * render their stats via client-side JS, and X/Instagram serve different
 * markup to non-browser clients).
 *
 * Usage:
 *   node scripts/update-follower-stats.mjs
 *   node scripts/update-follower-stats.mjs --limit=20
 *
 * For every influencer's supported platforms (YouTube, TikTok, X/Twitter,
 * Snapchat — Instagram is skipped, it forces a login wall even in a real
 * browser), visits the profile with Playwright and extracts the current
 * follower count directly from the rendered page. Updates
 * platforms[key].followers / followersNum, and recomputes totalFollowers /
 * totalFormatted as the sum across all of that influencer's platforms.
 * Does NOT touch tier/rank/rangeLabel — those are left for the admin panel
 * to recompute, since their exact thresholds aren't something this script
 * should guess at.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INDEX_HTML = path.join(ROOT, 'index.html');
const REPORT_PATH = path.join(ROOT, 'assets', 'influencers', '_stats_report.json');

const args = process.argv.slice(2);
const LIMIT = (() => {
  const a = args.find(x => x.startsWith('--limit='));
  return a ? parseInt(a.split('=')[1], 10) : Infinity;
})();

const CHECKPOINT_EVERY = 15;
const NAV_TIMEOUT_MS = 30000;
const SETTLE_MS = 4000;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const SUPPORTED_PLATFORMS = ['يوتيوب', 'تيك توك', 'تويتر/X', 'سناب شات'];

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
    const text = (await page.evaluate(() => document.body.innerText)).slice(0, 1500);
    const m = text.match(/([\d.,]+\s?[KMB]?)\s*followers/i);
    return m ? parseCount(m[1].trim()) : null;
  }

  return null;
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
  const original = loadData();
  const data = original.data;

  if (!fs.existsSync(INDEX_HTML + '.stats-bak')) {
    fs.copyFileSync(INDEX_HTML, INDEX_HTML + '.stats-bak');
    console.log('Backup written to index.html.stats-bak');
  }

  const targets = data.filter(d => SUPPORTED_PLATFORMS.some(p => d.platforms?.[p]?.url)).slice(0, LIMIT);
  console.log(`${targets.length} / ${data.length} records have at least one supported platform`);

  const browser = await chromium.launch();
  const report = fs.existsSync(REPORT_PATH) ? JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) : {};

  let processed = 0, updatedRecords = 0;

  for (const d of targets) {
    processed++;
    let anyUpdated = false;
    const perPlatform = {};

    for (const key of SUPPORTED_PLATFORMS) {
      const url = d.platforms?.[key]?.url;
      if (!url || !/^https?:\/\//i.test(url)) continue;

      const page = await browser.newPage({ viewport: { width: 500, height: 1000 }, userAgent: UA });
      let count = null;
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
        count = await extractFollowers(page, key);
      } catch (e) {
        // leave count null on any navigation/extraction failure
      } finally {
        await page.close();
      }

      if (count && count > 0) {
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
    }

    report[d.id] = { name: d.name, updated: perPlatform, totalFollowers: d.totalFollowers };
    console.log(`[${processed}/${targets.length}] ${d.name}: ${anyUpdated ? '✅ ' + JSON.stringify(perPlatform) : '—'}`);

    if (processed % CHECKPOINT_EVERY === 0) {
      saveData(original, data);
      fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
      console.log(`--- checkpoint saved (${processed}/${targets.length}) ---`);
    }
  }

  await browser.close();
  saveData(original, data);
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\nDone.');
  console.log(`Records with at least one updated platform: ${updatedRecords} / ${targets.length}`);
  console.log(`Report: ${path.relative(ROOT, REPORT_PATH)}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
