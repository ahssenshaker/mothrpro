#!/usr/bin/env node
/**
 * Scans influencer social media bios for phone/WhatsApp contact info.
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

const NAV_TIMEOUT_MS = 20_000
const SETTLE_MS = 2_500
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

// Ordered by scraping accessibility
const PRIORITY = ['تيك توك', 'سناب شات', 'تويتر/X', 'انستقرام', 'يوتيوب']

function extractContact(text) {
  if (!text) return null

  // wa.me link (most reliable)
  const waLink = text.match(/wa\.me\/(\d{7,15})/i)
  if (waLink) return { phone: '+' + waLink[1], source: 'whatsapp_link' }

  // Saudi / Gulf phone numbers
  const phone = text.match(/(?:(?:\+|00)966|0)(5\d[\s.\-]?\d{3}[\s.\-]?\d{4})/i)
  if (phone) {
    const digits = phone[0].replace(/\D/g, '')
    const normalized = digits.length === 12 ? '0' + digits.slice(3)  // 9665xxxxxxxx
                     : digits.length === 13 ? '0' + digits.slice(5)  // 009665xxxxxxxx
                     : digits                                          // 05xxxxxxxx
    return { phone: normalized, source: 'phone_number' }
  }

  return null
}

async function extractBio(page, platform) {
  await page.waitForTimeout(SETTLE_MS)

  if (platform === 'تيك توك') {
    const el = await page.$('[data-e2e="user-bio"]')
    return el ? (await el.textContent()).trim() : null
  }

  if (platform === 'سناب شات') {
    return page.evaluate(() => document.body.innerText.slice(0, 600))
  }

  if (platform === 'تويتر/X') {
    const el = await page.$('[data-testid="UserDescription"]')
    return el ? (await el.textContent()).trim() : null
  }

  if (platform === 'انستقرام') {
    return page.evaluate(() => {
      const m = document.querySelector('meta[name="description"], meta[property="og:description"]')
      return m ? m.getAttribute('content') : null
    })
  }

  if (platform === 'يوتيوب') {
    return page.evaluate(() => document.body.innerText.slice(0, 800))
  }

  return null
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

    for (const platform of PRIORITY) {
      if (contact) break
      const url = d.platforms?.[platform]?.url
      if (!url || !/^https?:\/\//i.test(url)) continue

      const page = await browser.newPage({ viewport: { width: 500, height: 900 }, userAgent: UA })
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS })
        const bio = await extractBio(page, platform)
        const c = extractContact(bio)
        if (c) contact = { ...c, platform, bio: bio?.slice(0, 200) }
      } catch {
        // skip failures silently
      } finally {
        await page.close()
      }
    }

    if (contact) {
      found.push({ id: d.id, name: d.name, ...contact })
      console.log(`✅  [${scanned}/${targets.length}] ${d.name} — ${contact.phone} (${contact.platform})`)
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
