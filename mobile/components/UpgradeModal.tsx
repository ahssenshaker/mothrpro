import { useState } from 'react'
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { useAuth } from '@/context/AuthContext'
import { PLANS, Plan, buildCheckoutUrl } from '@/lib/plans'
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'

interface Props {
  visible: boolean
  onClose: () => void
}

export default function UpgradeModal({ visible, onClose }: Props) {
  const { session, refreshSubscriber } = useAuth()
  const [buyingPlan, setBuyingPlan] = useState<Plan['id'] | null>(null)

  async function handleBuy(planId: Plan['id']) {
    setBuyingPlan(planId)
    try {
      const redirectUrl = Linking.createURL('payment-success')
      const url = buildCheckoutUrl(planId, session?.user?.email, redirectUrl)
      // openAuthSessionAsync (not openBrowserAsync) closes the in-app browser
      // automatically once Lemon Squeezy navigates to redirect_url - the same
      // moatherpro:// deep-link mechanism as Google sign-in, instead of
      // leaving the user to close the tab manually.
      await WebBrowser.openAuthSessionAsync(url, redirectUrl)
      // The webhook that activates the plan runs server-side and may take a
      // few seconds after the redirect fires, so keep polling briefly.
      const start = Date.now()
      const interval = setInterval(async () => {
        await refreshSubscriber()
        if (Date.now() - start > 60_000) clearInterval(interval)
      }, 5_000)
    } finally {
      setBuyingPlan(null)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
            <Text style={s.title}>⭐ مؤثر برو</Text>
            <View style={{ width: 24 }} />
          </View>
          <Text style={s.subtitle}>وصول لبيانات +500 مؤثر سعودي وخليجي</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {PLANS.map(plan => (
              <View
                key={plan.id}
                style={[s.card, plan.featured && s.cardFeatured]}
              >
                {plan.badge ? (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{plan.badge}</Text>
                  </View>
                ) : null}
                <Text style={s.icon}>{plan.icon}</Text>
                <Text style={s.planName}>{plan.name}</Text>
                <Text style={s.price}>{plan.price} ر.س</Text>
                <Text style={s.period}>{plan.period}</Text>
                <View style={s.feats}>
                  {plan.features.map(f => (
                    <Text key={f} style={s.featText}>• {f}</Text>
                  ))}
                </View>
                <TouchableOpacity
                  style={[s.buyBtn, plan.featured && s.buyBtnFeatured]}
                  onPress={() => handleBuy(plan.id)}
                  disabled={buyingPlan !== null}
                >
                  <Text style={[s.buyBtnText, plan.featured && s.buyBtnTextFeatured]}>
                    {buyingPlan === plan.id ? 'جاري الفتح...' : 'اشتر الآن'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
            <Text style={s.footNote}>
              بعد الدفع سيُفعَّل حسابك تلقائياً خلال دقيقة ✓{'\n'}يدعم Visa / Mastercard / PayPal
            </Text>
          </ScrollView>
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
