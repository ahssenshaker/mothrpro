#!/usr/bin/env node
/**
 * Verifies candidate platform URLs before they're allowed into the dataset.
 *
 * Reads assets/influencers/_url_candidates.json:
 *   { "<influencer id>": { "<platform key>": "<candidate url>", ... }, ... }
 *
 * Visits each candidate with a real browser and records what's actually
 * there — the profile's display name/handle and its follower count — into
 * assets/influencers/_url_candidates_report.json. It changes NOTHING in
 * index.html: a human reviews the report and applies only the candidates
 * whose profile provably matches the influencer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CANDIDATES_PATH = path.join(ROOT, 'assets', 'influencers', '_url_candidates.json');
const REPORT_PATH = path.join(ROOT, 'assets', 'influencers', '_url_candidates_report.json');

const NAV_TIMEOUT_MS = 30000;
const SETTLE_MS = 4000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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

async function inspect(page, url, platformKey) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
  await page.waitForTimeout(SETTLE_MS);
  const title = await page.title();
  const text = await page.evaluate(() => document.body.innerText);
  const head = text.slice(0, 2000);
  let followers = null;

  if (platformKey === 'يوتيوب') {
    const m = head.match(/([\d.,]+\s?[KMB]?)\s*subscribers/i);
    if (m) followers = parseCount(m[1].trim());
  } else if (platformKey === 'تيك توك') {
    const el = await page.$('[data-e2e="followers-count"]');
    if (el) followers = parseCount((await el.textContent()).trim());
  } else if (platformKey === 'تويتر/X') {
    const m = text.match(/([\d.,]+\s?[KMB]?)\s*Followers/i);
    if (m) followers = parseCount(m[1].trim());
  } else if (platformKey === 'سناب شات') {
    for (const line of text.split('\n').slice(0, 30)) {
      const m = line.match(/^\s*([\d.,]+\s?[KMB]?)\s*followers\b/i);
      if (m) { followers = parseCount(m[1].trim()); break; }
    }
  }

  return { title, followers, headSample: head.slice(0, 300) };
}

async function main() {
  const candidates = JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf8'));
  const browser = await chromium.launch();
  const report = {};

  for (const [id, platforms] of Object.entries(candidates)) {
    report[id] = {};
    for (const [key, url] of Object.entries(platforms)) {
      const page = await browser.newPage({ viewport: { width: 500, height: 1000 }, userAgent: UA });
      try {
        report[id][key] = { url, ...(await inspect(page, url, key)) };
      } catch (e) {
        report[id][key] = { url, error: e.message };
      } finally {
        await page.close();
      }
      const r = report[id][key];
      console.log(`${id} | ${key} | ${url}`);
      console.log(`   title: ${r.title || '-'} | followers: ${r.followers ?? 'NONE'}${r.error ? ' | ERROR: ' + r.error : ''}`);
    }
  }

  await browser.close();
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log('\nReport written to', path.relative(ROOT, REPORT_PATH));
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1); });
