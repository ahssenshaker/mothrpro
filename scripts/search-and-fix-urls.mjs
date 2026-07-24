#!/usr/bin/env node
/**
 * Auto-search, verify, and fix wrong platform URLs for influencers.
 *
 * Flow:
 *  1. Read _url_drift_suspects.json  (produced by update-follower-stats.mjs)
 *     and _wrong_url_suspects.json   (baseline wrong-URL list).
 *  2. For each suspect, search the platform for the influencer by name.
 *  3. Visit the top candidate profiles and compare follower counts.
 *  4. If a confident match is found (count within 3× of stored):
 *       → Update the URL in Supabase.
 *       → Remove the platform from _url_blocklist.json.
 *       → Mark the suspect as resolved.
 *  5. If no confident match is found:
 *       → Add the platform to _url_blocklist.json so future scrapes
 *         can't overwrite the stored count with a wrong-URL value.
 *  6. Write updated blocklist + _search_fix_report.json.
 *     Remove resolved entries from _url_drift_suspects.json.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/search-and-fix-urls.mjs
 *   Add --dry-run to preview without writing to Supabase.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT    = path.resolve(__dirname, '..');
const ASSETS  = path.join(ROOT, 'assets', 'influencers');

const DRIFT_PATH    = path.join(ASSETS, '_url_drift_suspects.json');
const WRONG_PATH    = path.join(ASSETS, '_wrong_url_suspects.json');
const BLOCKLIST_PATH= path.join(ASSETS, '_url_blocklist.json');
const REPORT_PATH   = path.join(ASSETS, '_search_fix_report.json');

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const DRY_RUN              = process.argv.includes('--dry-run');

// Confidence window: found count must be within this ratio of stored count.
// e.g. 0.3 → 3.0 means "between one-third and three times the stored value".
const CONFIDENCE_MIN_RATIO  = 0.3;
const CONFIDENCE_MAX_RATIO  = 3.0;
const CONFIDENCE_MIN_COUNT  = 100_000; // only trust results ≥ 100K

const NAV_TIMEOUT_MS = 30_000;
const SETTLE_MS      = 4_000;
const MAX_CANDIDATES = 3; // top N search results to inspect per suspect

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function loadJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function formatCount(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

function parseCount(str) {
  if (!str) return null;
  const m = str.replace(/,/g, '').match(/^([\d.]+)\s*([KMB])?$/i);
  if (!m) return null;
  let n = parseFloat(m[1]);
  const s = (m[2] || '').toUpperCase();
  if (s === 'K') n *= 1_000;
  else if (s === 'M') n *= 1_000_000;
  else if (s === 'B') n *= 1_000_000_000;
  return Math.round(n);
}

function isConfident(found, stored) {
  if (!found || found < CONFIDENCE_MIN_COUNT) return false;
  const ratio = found / stored;
  return ratio >= CONFIDENCE_MIN_RATIO && ratio <= CONFIDENCE_MAX_RATIO;
}

// ─── Platform: get follower count from a known profile URL ───────────────────
async function getFollowerCount(page, url, platform) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    await page.waitForTimeout(SETTLE_MS);
  } catch { return null; }

  try {
    if (platform === 'يوتيوب') {
      const text = (await page.evaluate(() => document.body.innerText)).slice(0, 2000);
      const m = text.match(/([\d.,]+\s?[KMB]?)\s*subscribers/i);
      return m ? parseCount(m[1].trim()) : null;
    }
    if (platform === 'تيك توك') {
      const el = await page.$('[data-e2e="followers-count"]');
      return el ? parseCount((await el.textContent()).trim()) : null;
    }
    if (platform === 'تويتر/X') {
      const text = await page.evaluate(() => document.body.innerText);
      const m = text.match(/([\d.,]+\s?[KMB]?)\s*Followers/i);
      return m ? parseCount(m[1].trim()) : null;
    }
    if (platform === 'سناب شات') {
      const lines = (await page.evaluate(() => document.body.innerText)).split('\n').slice(0, 30);
      for (const line of lines) {
        const m = line.match(/^\s*([\d.,]+\s?[KMB]?)\s*followers\b/i);
        if (m) return parseCount(m[1].trim());
      }
      return null;
    }
    if (platform === 'انستقرام') {
      const meta = await page.evaluate(() => {
        const el = document.querySelector('meta[property="og:description"]');
        return el ? el.getAttribute('content') : null;
      });
      if (meta) {
        const m = meta.match(/([\d.,]+\s?[KMB]?)\s*[Ff]ollowers/);
        if (m) return parseCount(m[1].trim());
      }
      const text = await page.evaluate(() => document.body.innerText);
      const m = text.match(/([\d.,]+\s?[KMB]?)\s*[Ff]ollowers/);
      return m ? parseCount(m[1].trim()) : null;
    }
  } catch { return null; }

  return null;
}

// ─── Platform: search for profile candidates ─────────────────────────────────
async function searchCandidates(browser, name, platform) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, userAgent: UA });
  const candidates = [];

  try {
    if (platform === 'تيك توك') {
      await page.goto(
        `https://www.tiktok.com/search/user?q=${encodeURIComponent(name)}`,
        { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS }
      );
      await page.waitForTimeout(SETTLE_MS);
      const hrefs = await page.evaluate(() => {
        const as = Array.from(document.querySelectorAll('a[href*="/@"]'));
        return [...new Set(as.map(a => a.href).filter(h => /tiktok\.com\/@[^/?]+$/.test(h)))];
      });
      candidates.push(...hrefs.slice(0, MAX_CANDIDATES));
    }

    if (platform === 'يوتيوب') {
      await page.goto(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(name)}`,
        { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS }
      );
      await page.waitForTimeout(SETTLE_MS);
      const hrefs = await page.evaluate(() => {
        const as = Array.from(document.querySelectorAll('a[href*="/@"], a[href*="/channel/"]'));
        return [...new Set(
          as.map(a => {
            const h = a.getAttribute('href') || '';
            if (h.startsWith('http')) return h;
            if (h.startsWith('/')) return 'https://www.youtube.com' + h;
            return null;
          }).filter(Boolean).filter(h => /youtube\.com\/([@]|channel\/)/.test(h))
        )];
      });
      candidates.push(...hrefs.slice(0, MAX_CANDIDATES));
    }

    if (platform === 'تويتر/X') {
      await page.goto(
        `https://twitter.com/search?q=${encodeURIComponent(name)}&f=user`,
        { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS }
      );
      await page.waitForTimeout(SETTLE_MS);
      const hrefs = await page.evaluate(() => {
        const as = Array.from(document.querySelectorAll('a[href^="/"][href*="/"]'));
        return [...new Set(
          as.map(a => a.getAttribute('href'))
            .filter(h => h && /^\/[A-Za-z0-9_]+$/.test(h))
            .map(h => 'https://twitter.com' + h)
        )];
      });
      candidates.push(...hrefs.slice(0, MAX_CANDIDATES));
    }

    if (platform === 'سناب شات') {
      // Snapchat doesn't have a public user search; skip auto-search.
    }

    if (platform === 'انستقرام') {
      // Instagram search requires login; skip auto-search.
    }
  } catch (e) {
    console.warn(`   search error for "${name}" | ${platform}: ${e.message}`);
  } finally {
    await page.close();
  }

  return candidates;
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────
async function loadInfluencers(supa) {
  const { data, error } = await supa.from('influencers').select('*');
  if (error) throw new Error('Load failed: ' + error.message);
  return data;
}

async function upsertInfluencer(supa, record) {
  const { error } = await supa.from('influencers').upsert(record, { onConflict: 'id' });
  if (error) throw new Error('Upsert failed: ' + error.message);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌  Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY');
    process.exit(1);
  }
  if (DRY_RUN) console.log('🔍  DRY RUN — Supabase will not be modified.\n');

  const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Merge drift suspects + baseline wrong-URL list into one work list.
  const driftSuspects = loadJson(DRIFT_PATH, []);
  const wrongSuspects = loadJson(WRONG_PATH, []);
  const blocklist     = loadJson(BLOCKLIST_PATH, {});

  // Deduplicate by id|platform or name|platform.
  const seen   = new Set();
  const allSuspects = [...driftSuspects, ...wrongSuspects].filter(s => {
    const key = `${s.id ?? s.name}|${s.platform}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (!allSuspects.length) {
    console.log('✅  No suspects to process.');
    return;
  }

  console.log(`📥  Loading influencers from Supabase…`);
  const influencers = await loadInfluencers(supa);
  const byId   = Object.fromEntries(influencers.map(r => [String(r.id), r]));
  const byName = {};
  for (const r of influencers) byName[r.name] = r;

  const browser = await chromium.launch();
  const updatedBlocklist = structuredClone(blocklist);
  const report = { fixed: [], blocked: [], notFound: [], searchFailed: [] };
  const resolvedKeys = new Set(); // suspects that got fixed (remove from drift file)

  console.log(`\n🔎  Processing ${allSuspects.length} suspects…\n`);

  for (const suspect of allSuspects) {
    const rec = (suspect.id ? byId[String(suspect.id)] : null) ?? byName[suspect.name];
    if (!rec) {
      console.warn(`   ⚠️  Not found in Supabase: "${suspect.name}"`);
      report.notFound.push({ name: suspect.name, platform: suspect.platform });
      continue;
    }

    const id       = String(rec.id);
    const platform = suspect.platform;
    const stored   = suspect.stored ?? rec.platforms?.[platform]?.followersNum ?? 0;
    const suspectKey = `${id}|${platform}`;

    console.log(`\n[${suspect.name}] ${platform} — stored: ${formatCount(stored)}`);

    // ── Search for candidate URLs ─────────────────────────────────────────
    const candidateUrls = await searchCandidates(browser, rec.name, platform);
    console.log(`   Found ${candidateUrls.length} candidate(s): ${candidateUrls.join(', ') || '—'}`);

    let bestUrl    = null;
    let bestCount  = null;

    for (const url of candidateUrls) {
      // Skip if it's the same (broken) URL we already have.
      const currentUrl = rec.platforms?.[platform]?.url;
      if (url === currentUrl) continue;

      const page = await browser.newPage({ viewport: { width: 500, height: 1000 }, userAgent: UA });
      let count = null;
      try {
        count = await getFollowerCount(page, url, platform);
      } catch { /* ignore */ } finally {
        await page.close();
      }

      console.log(`   → ${url} : ${count != null ? formatCount(count) : 'N/A'}`);

      if (count && isConfident(count, stored)) {
        if (!bestCount || Math.abs(count - stored) < Math.abs(bestCount - stored)) {
          bestUrl   = url;
          bestCount = count;
        }
      }
    }

    if (bestUrl && bestCount) {
      // ── Confident match — fix Supabase ─────────────────────────────────
      const updatedPlatforms = structuredClone(rec.platforms ?? {});
      updatedPlatforms[platform] = {
        ...(updatedPlatforms[platform] ?? {}),
        url: bestUrl,
        followersNum: bestCount,
        followers: formatCount(bestCount),
      };
      const total = Object.values(updatedPlatforms)
        .reduce((s, p) => s + (Number(p.followersNum) || 0), 0);

      console.log(`   ✅ MATCH → ${bestUrl} (${formatCount(bestCount)})`);

      if (!DRY_RUN) {
        await upsertInfluencer(supa, {
          ...rec,
          platforms: updatedPlatforms,
          totalFollowers: total,
          totalFormatted: formatCount(total),
        });
      }

      // Remove from blocklist (URL now correct).
      if (updatedBlocklist[id]) {
        updatedBlocklist[id] = updatedBlocklist[id].filter(p => p !== platform);
        if (!updatedBlocklist[id].length) delete updatedBlocklist[id];
      }

      report.fixed.push({
        name: rec.name, id, platform,
        newUrl: bestUrl, newCount: bestCount,
        oldUrl: rec.platforms?.[platform]?.url ?? null,
        storedCount: stored,
      });
      resolvedKeys.add(suspectKey);
    } else {
      // ── No confident match — ensure platform stays blocked ──────────────
      const alreadyBlocked = (updatedBlocklist[id] ?? []).includes(platform);
      if (!alreadyBlocked) {
        if (!updatedBlocklist[id]) updatedBlocklist[id] = [];
        updatedBlocklist[id].push(platform);
        console.log(`   🚫 No match — blocklisted`);
        report.blocked.push({ name: rec.name, id, platform });
      } else {
        console.log(`   ✓ No match — already blocked`);
        report.blocked.push({ name: rec.name, id, platform, wasAlreadyBlocked: true });
      }
    }
  }

  await browser.close();

  // ── Persist blocklist ─────────────────────────────────────────────────────
  if (!DRY_RUN) {
    fs.writeFileSync(BLOCKLIST_PATH, JSON.stringify(updatedBlocklist, null, 2));
    console.log(`\n💾  Blocklist saved.`);
  }

  // ── Remove resolved entries from drift suspects file ──────────────────────
  if (!DRY_RUN && resolvedKeys.size) {
    const remaining = driftSuspects.filter(
      s => !resolvedKeys.has(`${s.id ?? byName[s.name]?.id}|${s.platform}`)
    );
    fs.writeFileSync(DRIFT_PATH, JSON.stringify(remaining, null, 2));
    console.log(`   Removed ${resolvedKeys.size} resolved drift suspect(s).`);
  }

  // ── Save report ───────────────────────────────────────────────────────────
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log(`✅  URLs auto-corrected in Supabase : ${report.fixed.length}`);
  console.log(`🚫  Platforms blocked (no match)    : ${report.blocked.filter(b => !b.wasAlreadyBlocked).length}`);
  console.log(`✓   Already blocked                 : ${report.blocked.filter(b => b.wasAlreadyBlocked).length}`);
  if (report.notFound.length) console.log(`⚠️   Not found in DB                : ${report.notFound.length}`);
  if (DRY_RUN) console.log('\n[DRY RUN — no changes applied]');
  console.log(`📄  Report → ${path.relative(ROOT, REPORT_PATH)}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
