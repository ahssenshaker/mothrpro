import { useEffect, useState } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { Colors, Spacing, FontSize } from '@/constants/theme'

// Fallback landing screen for the moatherpro://payment-success deep link.
// Normally UpgradeModal's openAuthSessionAsync() catches this redirect and
// shows the success state inline without the app ever navigating here - this
// route only fires if the OS reopens the app from the link outside that
// session (e.g. the app was backgrounded during checkout).
export default function PaymentSuccessScreen() {
  const router = useRouter()
  const { refreshSubscriber } = useAuth()
  const { t } = useLanguage()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let cancelled = false
    const start = Date.now()
    const interval = setInterval(async () => {
      const s = await refreshSubscriber()
      const activated = s && (s.plan === 'pro' || s.plan === 'credits')
      if (cancelled) return
      if (activated || Date.now() - start > 60_000) {
        clearInterval(interval)
        setChecking(false)
        setTimeout(() => { if (!cancelled) router.replace('/(main)') }, 1200)
      }
    }, 3_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [refreshSubscriber, router])

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.wrap}>
        <Text style={s.icon}>✅</Text>
        <Text style={s.title}>{t('paymentSuccessTitle')}</Text>
        {checking ? (
          <>
            <ActivityIndicator color={Colors.gold} style={{ marginVertical: Spacing.md }} />
            <Text style={s.status}>{t('paymentActivating')}</Text>
          </>
        ) : (
          <Text style={s.status}>{t('paymentActivated')}</Text>
        )}
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  icon: { fontSize: 56, marginBottom: Spacing.md },
  title: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  status: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
})
