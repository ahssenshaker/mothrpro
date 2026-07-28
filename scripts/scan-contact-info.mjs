#!/usr/bin/env node
/**
 * Scans influencer social media profiles for phone/WhatsApp contact info.
 * Follows linktree/bio aggregator pages when found.
 * Results saved to assets/influencers/_contact_report.json (not exposed via API).
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/scan-contact-info.mjs
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/scan-contact-info.mjs --limit=50
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const REPORT_PATH = path.join(ROOT, 'assets', 'influencers', '_contact_report.json')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌  Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY')
  process.exit(1)
}
const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const args = process.argv.slice(2)
const LIMIT = (() => {
  const a = args.find(x => x.startsWith('--limit='))
  return a ? parseInt(a.split('=')[1], 10) : Infinity
})()

const NAV_TIMEOUT_MS = 25_000
const SETTLE_MS = 3_000
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// All supported platforms — scan ALL, not just first match
const PLATFORMS = ['تيك توك', 'سناب شات', 'تويتر/X', 'انستقرام', 'يوتيوب']

// Link aggregator domains — follow these pages to find contact buttons
const LINK_AGGREGATORS = [
  'linktr.ee', 'bio.link', 'beacons.ai', 'linkin.bio',
  'msha.ke', 'campsite.bio', 'tap.bio', 'lnk.bio',
  'solo.to', 'allmylinks.com', 'flowpage.com',
]

// Arabic digit map
const AR_TO_EN = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' }
function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d => AR_TO_EN[d] || d)
}

function extractContact(text) {
  if (!text) return null
  const t = normalizeDigits(text)

  // wa.me or api.whatsapp.com link
  const waLink = t.match(/wa\.me\/(?:966)?(5\d{8})/i)
    || t.match(/wa\.me\/(966\d{9})/i)
    || t.match(/api\.whatsapp\.com\/send\?phone=(966\d{9}|\d{10,12})/i)
  if (waLink) {
    const num = waLink[1]
    return { phone: num.length === 9 ? '0' + num : num, source: 'whatsapp_link' }
  }

  // Saudi with country code (+966 / 00966 / 966)
  const intl = t.match(/(?:\+966|00966|966)\s?(5\d[\s.\-]?\d{3}[\s.\-]?\d{4})/i)
  if (intl) {
    return { phone: '0' + intl[1].replace(/\D/g, ''), source: 'phone' }
  }

  // Local Saudi format 05xxxxxxxx
  const local = t.match(/(?:^|[\s,:(|/])(05\d[\s.\-]?\d{3}[\s.\-]?\d{4})(?:[\s,):$]|$)/m)
  if (local) {
    return { phone: local[1].replace(/\D/g, ''), source: 'phone' }
  }

  return null
}

function isAggregator(url) {
  try {
    return LINK_AGGREGATORS.some(d => new URL(url).hostname.includes(d))
  } catch { return false }
}

async function extractExternalLinks(page, platform) {
  // Get any external link placed in the bio/profile link slot
  try {
    if (platform === 'تيك توك') {
      const el = await page.$('[data-e2e="user-link"] a, a[data-e2e="user-link"]')
      if (el) return [await el.getAttribute('href')]
    }
    if (platform === 'انستقرام') {
      // Instagram bio link is in JSON data or link element
      const links = await page.evaluate(() => {
        const anchors = [...document.querySelectorAll('a[href]')]
        return anchors
          .map(a => a.href)
          .filter(h => h && !h.includes('instagram.com') && h.startsWith('http'))
          .slice(0, 5)
      })
      return links
    }
    if (platform === 'يوتيوب') {
      const links = await page.evaluate(() => {
        return [...document.querySelectorAll('a[href]')]
          .map(a => a.href)
          .filter(h => h && !h.includes('youtube.com') && !h.includes('google.com') && h.startsWith('http'))
          .slice(0, 10)
      })
      return links
    }
    if (platform === 'سناب شات') {
      const links = await page.evaluate(() => {
        return [...document.querySelectorAll('a[href]')]
          .map(a => a.href)
          .filter(h => h && !h.includes('snapchat.com') && h.startsWith('http'))
          .slice(0, 5)
      })
      return links
    }
    if (platform === 'تويتر/X') {
      const el = await page.$('[data-testid="UserUrl"] a')
      if (el) return [await el.getAttribute('href')]
    }
  } catch {}
  return []
}

async function extractBio(page, platform) {
  await page.waitForTimeout(SETTLE_MS)
  try {
    if (platform === 'تيك توك') {
      const el = await page.$('[data-e2e="user-bio"]')
      return el ? (await el.textContent()).trim() : null
    }
    if (platform === 'سناب شات') {
      return page.evaluate(() => document.body.innerText.slice(0, 800))
    }
    if (platform === 'تويتر/X') {
      const el = await page.$('[data-testid="UserDescription"]')
      return el ? (await el.textContent()).trim() : null
    }
    if (platform === 'انستقرام') {
      return page.evaluate(() => {
        const m = document.querySelector('meta[name="description"], meta[property="og:description"]')
        return m ? m.getAttribute('content') : document.body.innerText.slice(0, 500)
      })
    }
    if (platform === 'يوتيوب') {
      return page.evaluate(() => document.body.innerText.slice(0, 1200))
    }
  } catch {}
  return null
}

async function scanAggregatorPage(browser, url) {
  const page = await browser.newPage({ viewport: { width: 500, height: 900 }, userAgent: UA })
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
    await page.waitForTimeout(2000)
    const text = await page.evaluate(() => document.body.innerText)
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a[href]')].map(a => a.href).join('\n')
    )
    return text + '\n' + links
  } catch {
    return null
  } finally {
    await page.close()
  }
}

async function main() {
  console.log('📥  Loading influencers from Supabase...')
  const { data, error } = await supa
    .from('influencers')
    .select('id, name, platforms')
    .order('rank', { ascending: true })
  if (error) throw new Error('Supabase: ' + error.message)

  const targets = LIMIT === Infinity ? data : data.slice(0, LIMIT)
  console.log(`Scanning ${targets.length} / ${data.length} influencers\n`)

  const browser = await chromium.launch()
  const found = []
  let scanned = 0

  for (const d of targets) {
    scanned++
    let contact = null
    const checkedLinks = new Set()

    for (const platform of PLATFORMS) {
      if (contact) break
      const url = d.platforms?.[platform]?.url
      if (!url || !/^https?:\/\//i.test(url)) continue

      const page = await browser.newPage({ viewport: { width: 500, height: 900 }, userAgent: UA })
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })

        // 1. Check bio text
        const bio = await extractBio(page, platform)
        contact = extractContact(bio)
        if (contact) { contact.platform = platform; break }

        // 2. Check external links in profile
        const externalLinks = await extractExternalLinks(page, platform)
        for (const link of externalLinks) {
          if (!link || checkedLinks.has(link)) continue
          checkedLinks.add(link)

          // Direct wa.me link
          const c = extractContact(link)
          if (c) { contact = { ...c, platform, source: 'bio_link' }; break }

          // Link aggregator — follow and scan
          if (isAggregator(link)) {
            const aggText = await scanAggregatorPage(browser, link)
            const c2 = extractContact(aggText)
            if (c2) { contact = { ...c2, platform, source: 'linktree' }; break }
          }
        }
      } catch {
        // skip on failure
      } finally {
        await page.close()
      }
    }

    if (contact) {
      found.push({ id: d.id, name: d.name, ...contact })
      console.log(`✅  [${scanned}/${targets.length}] ${d.name} — ${contact.phone} (${contact.platform} / ${contact.source})`)
    } else {
      process.stdout.write(`\r⏳  [${scanned}/${targets.length}] scanning...`)
    }
  }

  await browser.close()
  console.log('\n')

  const report = {
    generatedAt: new Date().toISOString(),
    total: targets.length,
    withContact: found.length,
    results: found,
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))

  console.log(`📊  Result: ${found.length} / ${targets.length} influencers have contact info`)
  console.log(`📄  Report: assets/influencers/_contact_report.json`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
