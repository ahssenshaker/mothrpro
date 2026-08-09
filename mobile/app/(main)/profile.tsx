import { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as WebBrowser from 'expo-web-browser'
import { useAuth } from '@/context/AuthContext'
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'
import UpgradeModal from '@/components/UpgradeModal'

const PLAN_LABEL: Record<string, string> = {
  free: 'مجاني',
  trial: 'تجريبي',
  pro: 'برو',
  admin: 'مدير',
  credits: 'كريدت',
}

const PLAN_COLOR: Record<string, string> = {
  free: Colors.textMuted,
  trial: Colors.accent,
  pro: Colors.gold,
  admin: Colors.purple,
  credits: Colors.gold,
}

function fmt(dateStr?: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function trialHours(expiresAt?: string) {
  if (!expiresAt) return null
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return null
  return Math.floor(diff / 3_600_000)
}

export default function ProfileScreen() {
  const { session, subscriber, effectivePlan, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const email = session?.user?.email || ''
  const planLabel = PLAN_LABEL[effectivePlan] || 'مجاني'
  const planColor = PLAN_COLOR[effectivePlan] || Colors.textMuted
  const hours = trialHours(subscriber?.expires_at)
  const initials = email.slice(0, 2).toUpperCase()

  async function handleSignOut() {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'خروج',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          await signOut()
        },
      },
    ])
  }

  return (
    <SafeAreaView style={s.screen}>
      <ScrollView contentContainerStyle={s.scroll}>

        {/* Avatar */}
        <View style={s.avatarBox}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={s.emailText}>{email}</Text>
          <View style={[s.planBadge, { backgroundColor: planColor + '22', borderColor: planColor }]}>
            <Text style={[s.planBadgeText, { color: planColor }]}>{planLabel}</Text>
          </View>
        </View>

        {/* Trial banner */}
        {effectivePlan === 'trial' && hours !== null && (
          <View style={s.trialBanner}>
            <Text style={s.trialText}>⏳ ينتهي اشتراكك التجريبي خلال {hours} ساعة</Text>
          </View>
        )}

        {/* Subscription card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>تفاصيل الاشتراك</Text>
          <Row label="الاشتراك" value={planLabel} valueColor={planColor} />
          {subscriber?.activated_at && (
            <Row label="عضو منذ" value={fmt(subscriber.activated_at)} />
          )}
          {effectivePlan === 'trial' && subscriber?.expires_at && (
            <Row label="ينتهي في" value={fmt(subscriber.expires_at)} valueColor={Colors.red} />
          )}
          {effectivePlan === 'pro' && !subscriber?.expires_at && (
            <Row label="نوع الاشتراك" value="دائم" valueColor={Colors.green} />
          )}
          {effectivePlan === 'credits' && (
            <>
              <Row label="الكريدتات المتبقية" value={String(subscriber?.credits_remaining || 0)} valueColor={Colors.gold} />
              <Row label="المؤثرين المفتوحين" value={String(subscriber?.unlocked_ids?.length || 0)} />
            </>
          )}
        </View>

        {/* Upgrade section */}
        {(effectivePlan === 'free' || effectivePlan === 'trial' || effectivePlan === 'credits') && (
          <View style={s.upgradeCard}>
            <Text style={s.upgradeTitle}>🚀 ترقية للبرو</Text>
            <Text style={s.upgradeDesc}>
              {effectivePlan === 'credits'
                ? 'احتجت تفتح أكثر؟ اشترِ كريدت إضافي أو رقّي لوصول كامل دائم'
                : 'احصل على بيانات كاملة لجميع المؤثرين: الأسعار، معدل التفاعل، تحليل الجمهور'}
            </Text>
            <TouchableOpacity style={s.upgradeBtn} onPress={() => setShowUpgrade(true)}>
              <Text style={s.upgradeBtnText}>عرض الخطط</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Pro features */}
        {(effectivePlan === 'pro' || effectivePlan === 'admin') && (
          <View style={s.card}>
            <Text style={s.cardTitle}>مميزات البرو ✅</Text>
            {[
              'بيانات كاملة لجميع المؤثرين',
              'أسعار المؤثرين الفعلية',
              'معدل التفاعل والإحصاءات',
              'تحليل الجمهور (السن والجنس)',
              'روابط الملفات الشخصية',
            ].map(f => (
              <View key={f} style={s.featureRow}>
                <Text style={s.featureText}>{f}</Text>
                <Text style={{ color: Colors.green }}>✓</Text>
              </View>
            ))}
          </View>
        )}

        {/* Legal */}
        <View style={s.card}>
          <TouchableOpacity
            style={s.legalRow}
            onPress={() => WebBrowser.openBrowserAsync('https://www.moatherpro.com/privacy')}
          >
            <Text style={s.legalArrow}>‹</Text>
            <Text style={s.legalText}>سياسة الخصوصية</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.legalRow}
            onPress={() => WebBrowser.openBrowserAsync('https://www.moatherpro.com/refund')}
          >
            <Text style={s.legalArrow}>‹</Text>
            <Text style={s.legalText}>سياسة الاسترداد</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          <Text style={s.logoutText}>{signingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}</Text>
        </TouchableOpacity>

        <Text style={s.versionText}>مؤثر برو • الإصدار 1.0{'\n'}© 2026 جميع الحقوق محفوظة</Text>
      </ScrollView>

      <UpgradeModal visible={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </SafeAreaView>
  )
}

function Row({
  label,
  value,
  valueColor = Colors.text,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <View style={s.row}>
      <Text style={[s.rowValue, { color: valueColor }]}>{value}</Text>
      <Text style={s.rowLabel}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: Colors.bg },
  scroll:        { padding: Spacing.md, paddingBottom: 40 },
  avatarBox:     { alignItems: 'center', marginTop: 24, marginBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.s3,
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarText:    { color: Colors.gold, fontSize: FontSize.xl, fontWeight: '800' },
  emailText:     { color: Colors.text, fontSize: FontSize.md, fontWeight: '500', marginBottom: 8 },
  planBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  planBadgeText: { fontWeight: '700', fontSize: FontSize.sm },
  trialBanner: {
    backgroundColor: Colors.accent + '22',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  trialText:     { color: Colors.accent, textAlign: 'center', fontWeight: '600' },
  card: {
    backgroundColor: Colors.s1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle:     { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', textAlign: 'right', marginBottom: Spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLabel:      { color: Colors.textMuted, fontSize: FontSize.sm },
  rowValue:      { fontWeight: '600', fontSize: FontSize.sm },
  featureRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border },
  featureText:   { color: Colors.text, fontSize: FontSize.sm, textAlign: 'right' },
  legalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  legalArrow:    { color: Colors.textMuted, fontSize: FontSize.md },
  legalText:     { color: Colors.text, fontSize: FontSize.sm },
  upgradeCard: {
    backgroundColor: Colors.gold + '15',
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.gold,
    alignItems: 'center',
  },
  upgradeTitle:   { color: Colors.gold, fontSize: FontSize.lg, fontWeight: '800', marginBottom: 8 },
  upgradeDesc:    { color: Colors.text, fontSize: FontSize.sm, textAlign: 'center', marginBottom: 12, lineHeight: 22 },
  upgradePrice:   { color: Colors.gold, fontSize: FontSize.xl, fontWeight: '800', marginBottom: 16 },
  upgradeBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingHorizontal: 32,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  upgradeBtnText: { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },
  logoutBtn: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.red,
  },
  logoutText:     { color: Colors.red, fontWeight: '600', fontSize: FontSize.md },
  versionText:    { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'center', marginTop: Spacing.lg },
})
