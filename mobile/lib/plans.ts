// Mirrors window.LS_PLANS / buildLsUrl() / the plan-card content in index.html.
// Source: uploaded index_41.html (2026-08-09) — the live site had moved past
// what was committed to the repo (single 149 SAR/month plan).

export interface Plan {
  id: 'credits' | 'annual' | 'lifetime'
  icon: string
  name: string
  price: number
  period: string
  features: string[]
  featured?: boolean
  badge?: string
}

export const PLANS: Plan[] = [
  {
    id: 'credits',
    icon: '⚡',
    name: 'كريدت',
    price: 49,
    period: '10 مؤثرين',
    features: ['فتح ملفات 10 مؤثرين', 'أسعار وروابط وإحصاءات', 'صلاحية دائمة للمفتوحين'],
  },
  {
    id: 'annual',
    icon: '📅',
    name: 'برو',
    price: 149,
    period: '/ سنة',
    features: ['وصول كامل لجميع المؤثرين', 'أسعار وروابط وإحصاءات', 'يتجدد سنوياً'],
    featured: true,
    badge: '⭐ الأكثر شعبية',
  },
  {
    id: 'lifetime',
    icon: '♾️',
    name: 'برو بلس',
    price: 349,
    period: 'دفعة واحدة',
    features: ['وصول كامل للأبد', 'أسعار وروابط وإحصاءات', 'بدون تجديد أبداً'],
  },
]

const LS_CHECKOUT_URLS: Record<Plan['id'], string> = {
  credits: 'https://moatherpro.lemonsqueezy.com/checkout/buy/5c6a8277-c31d-4f29-b40f-44e22fdaf99e',
  annual: 'https://moatherpro.lemonsqueezy.com/checkout/buy/1c3132f7-85d2-4bef-9e5d-50a0daffd046',
  lifetime: 'https://moatherpro.lemonsqueezy.com/checkout/buy/e674bbca-e1ec-4758-badc-06de80f70bce',
}

export function buildCheckoutUrl(planId: Plan['id'], email: string | undefined, redirectUrl: string): string {
  const base = LS_CHECKOUT_URLS[planId]
  const params = new URLSearchParams({
    'checkout[locale]': 'en',
    'checkout[billing_address_country]': 'SA',
    // Lemon Squeezy navigates here once checkout completes - a moatherpro://
    // deep link, so WebBrowser.openAuthSessionAsync can detect it and close
    // the in-app browser automatically, the same way Google sign-in does.
    redirect_url: redirectUrl,
  })
  if (email) {
    params.set('checkout[email]', email)
    params.set('checkout[custom][account_email]', email)
  }
  return `${base}?${params.toString()}`
}
