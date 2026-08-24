import { useState } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { PLANS, Plan, buildCheckoutUrl } from '@/lib/plans'
import { flexRow, textAlign as textAlignFor } from '@/lib/rtl'
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'

interface Props {
  visible: boolean
  onClose: () => void
}

type PaymentStatus = 'idle' | 'activating' | 'activated' | 'slow'

export default function UpgradeModal({ visible, onClose }: Props) {
  const { session, subscriber, refreshSubscriber } = useAuth()
  const { t, lang } = useLanguage()
  const [buyingPlan, setBuyingPlan] = useState<Plan['id'] | null>(null)
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle')

  async function handleBuy(planId: Plan['id']) {
    setBuyingPlan(planId)
    try {
      const redirectUrl = Linking.createURL('payment-success')
      const url = buildCheckoutUrl(planId, session?.user?.email, redirectUrl)
      // openAuthSessionAsync (not openBrowserAsync) closes the in-app browser
      // automatically once Lemon Squeezy navigates to redirect_url - the same
      // moatherpro:// deep-link mechanism as Google sign-in, instead of
      // leaving the user to close the tab manually.
      const result = await WebBrowser.openAuthSessionAsync(url, redirectUrl)
      if (result.type !== 'success') return

      // Show a visible "activating" state instead of silently polling in the
      // background - the webhook that activates the plan runs server-side
      // and may take a few seconds after the redirect fires.
      setPaymentStatus('activating')
      const prevPlan = subscriber?.plan ?? 'free'
      const prevCredits = subscriber?.credits_remaining ?? 0
      const start = Date.now()
      const interval = setInterval(async () => {
        const updated = await refreshSubscriber()
        const s = updated ?? null
        const activated = s && (s.plan === 'pro' || (s.plan === 'credits' && (prevPlan !== 'credits' || (s.credits_remaining ?? 0) > prevCredits)))
        if (activated) {
          clearInterval(interval)
          setPaymentStatus('activated')
        } else if (Date.now() - start > 60_000) {
          clearInterval(interval)
          setPaymentStatus('slow')
        }
      }, 3_000)
    } finally {
      setBuyingPlan(null)
    }
  }

  function handleDone() {
    setPaymentStatus('idle')
    onClose()
  }

  const handleClose = paymentStatus === 'activated' ? handleDone : onClose

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={[s.header, { flexDirection: flexRow(lang) }]}>
            <TouchableOpacity onPress={handleClose}>
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
            <Text style={s.title}>⭐ {t('appName')}</Text>
            <View style={{ width: 24 }} />
          </View>

          {paymentStatus !== 'idle' ? (
            <View style={s.successWrap}>
              <Text style={s.successIcon}>{paymentStatus === 'activated' ? '🎉' : '✅'}</Text>
              <Text style={s.successTitle}>{t('paymentSuccessTitle')}</Text>
              <Text style={s.successStatus}>
                {paymentStatus === 'activating' ? t('paymentActivating') : null}
                {paymentStatus === 'activated' ? t('paymentActivated') : null}
                {paymentStatus === 'slow' ? t('paymentActivatingSlow') : null}
              </Text>
              {paymentStatus === 'activated' ? (
                <TouchableOpacity style={[s.buyBtn, s.buyBtnFeatured, { alignSelf: 'stretch', marginTop: Spacing.md }]} onPress={handleDone}>
                  <Text style={[s.buyBtnText, s.buyBtnTextFeatured]}>{t('paymentDone')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
          <>
          <Text style={s.subtitle}>{t('plansSubtitle')}</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {PLANS.map(plan => (
              <View
                key={plan.id}
                style={[s.card, plan.featured && s.cardFeatured]}
              >
                {plan.badge ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{lang === 'en' ? plan.badgeEn : plan.badge}</Text>
                  </View>
                ) : null}
                <Text style={s.icon}>{plan.icon}</Text>
                <Text style={s.planName}>{lang === 'en' ? plan.nameEn : plan.name}</Text>
                <Text style={s.price}>{plan.price} {t('sar')}</Text>
                <Text style={s.period}>{lang === 'en' ? plan.periodEn : plan.period}</Text>
                <View style={s.feats}>
                  {(lang === 'en' ? plan.featuresEn : plan.features).map(f => (
                    <Text key={f} style={[s.featText, { textAlign: textAlignFor(lang) }]}>• {f}</Text>
                  ))}
                </View>
                <TouchableOpacity
                  style={[s.buyBtn, plan.featured && s.buyBtnFeatured]}
                  onPress={() => handleBuy(plan.id)}
                  disabled={buyingPlan !== null}
                >
                  <Text style={[s.buyBtnText, plan.featured && s.buyBtnTextFeatured]}>
                    {buyingPlan === plan.id ? t('opening') : t('buyNow')}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            <Text style={s.footNote}>{t('plansFootNote')}</Text>
          </ScrollView>
          </>
          )}
        </View>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.s1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.md,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  closeText: { color: Colors.textMuted, fontSize: FontSize.lg },
  title: { color: Colors.gold, fontSize: FontSize.lg, fontWeight: '800' },
  subtitle: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: 8, marginBottom: Spacing.md },
  successWrap: { alignItems: 'center', paddingVertical: Spacing.lg, paddingHorizontal: Spacing.md },
  successIcon: { fontSize: 56, marginBottom: Spacing.md },
  successTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  successStatus: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 20 },
  card: {
    backgroundColor: Colors.s2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  cardFeatured: { borderColor: Colors.gold, backgroundColor: Colors.gold + '0d' },
  badge: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 8,
  },
  badgeText: { color: Colors.bg, fontSize: FontSize.xs, fontWeight: '800' },
  icon: { fontSize: 28, marginBottom: 4 },
  planName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '800' },
  price: { color: Colors.accent, fontSize: FontSize.xl, fontWeight: '800', marginTop: 4 },
  period: { color: Colors.textMuted, fontSize: FontSize.xs, marginBottom: Spacing.sm },
  feats: { alignSelf: 'stretch', marginBottom: Spacing.md },
  featText: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'right', lineHeight: 20 },
  buyBtn: {
    alignSelf: 'stretch',
    backgroundColor: Colors.s3,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buyBtnFeatured: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  buyBtnText: { color: Colors.text, fontWeight: '700', fontSize: FontSize.sm },
  buyBtnTextFeatured: { color: Colors.bg },
  footNote: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center', marginTop: 4, marginBottom: 16, lineHeight: 18 },
})
