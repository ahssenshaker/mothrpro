import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/AuthContext'
import { fetchAllSubscribers, subscriberAction, deleteSubscriber, Subscriber } from '@/lib/api'
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

type RowKind = 'admin' | 'credits' | 'trial' | 'expiredPro' | 'annualPro' | 'lifetimePro' | 'free'

function classify(s: Subscriber): RowKind {
  const now = Date.now()
  const expiresMs = s.expires_at ? new Date(s.expires_at).getTime() - now : null
  if (s.plan === 'admin') return 'admin'
  if (s.plan === 'credits') return 'credits'
  if (s.plan === 'pro' && s.expires_at && expiresMs !== null) {
    if (expiresMs > 0 && expiresMs <= TWO_DAYS_MS) return 'trial'
    if (expiresMs <= 0) return 'expiredPro'
    return 'annualPro'
  }
  if (s.plan === 'pro' && !s.expires_at) return 'lifetimePro'
  return 'free'
}

const KIND_LABEL: Record<RowKind, string> = {
  admin: '👑 أدمن',
  credits: '⚡ كريدت',
  trial: '🎁 تجربة',
  expiredPro: 'منتهية',
  annualPro: '⭐ برو',
  lifetimePro: '♾️ برو بلس',
  free: 'مجاني',
}

const KIND_COLOR: Record<RowKind, string> = {
  admin: Colors.purple,
  credits: Colors.gold,
  trial: Colors.green,
  expiredPro: Colors.red,
  annualPro: Colors.accent,
  lifetimePro: Colors.purple,
  free: Colors.textMuted,
}

type TabFilter = 'all' | 'pro' | 'credits' | 'trial' | 'free'

export default function AdminUsersScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const [subs, setSubs] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<TabFilter>('all')
  const [grantEmail, setGrantEmail] = useState('')
  const [granting, setGranting] = useState<string | null>(null)
  const [grantMsg, setGrantMsg] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adminMsg, setAdminMsg] = useState('')

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchAllSubscribers(session.access_token)
      setSubs(data)
    } catch (e: any) {
      setError(e?.message || 'تعذّر التحميل')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  const stats = useMemo(() => {
    const kinds = subs.map(classify)
    return {
      total: subs.length,
      pro: kinds.filter(k => k === 'annualPro' || k === 'lifetimePro').length,
      trial: kinds.filter(k => k === 'trial').length,
      credits: kinds.filter(k => k === 'credits').length,
      admin: kinds.filter(k => k === 'admin').length,
      free: kinds.filter(k => k === 'free' || k === 'expiredPro').length,
    }
  }, [subs])

  const filtered = useMemo(() => {
    let list = subs
    if (tab === 'pro') list = list.filter(s => { const k = classify(s); return k === 'annualPro' || k === 'lifetimePro' })
    else if (tab === 'credits') list = list.filter(s => classify(s) === 'credits')
    else if (tab === 'trial') list = list.filter(s => classify(s) === 'trial')
    else if (tab === 'free') list = list.filter(s => { const k = classify(s); return k === 'free' || k === 'expiredPro' })

    const q = search.trim().toLowerCase()
    if (q) list = list.filter(s => (s.email || '').toLowerCase().includes(q))
    return list
  }, [subs, tab, search])

  async function handleGrant(action: 'grant-credits' | 'activate-annual' | 'activate' | 'grant-trial') {
    if (!session) return
    const email = grantEmail.trim()
    if (!email) {
      setGrantMsg('أدخل البريد الإلكتروني')
      return
    }
    setGranting(action)
    setGrantMsg('')
    try {
      await subscriberAction(session.access_token, action, { email })
      setGrantMsg('✅ تم بنجاح')
      setGrantEmail('')
      await load()
    } catch (e: any) {
      setGrantMsg(`خطأ: ${e?.message || 'فشل'}`)
    } finally {
      setGranting(null)
    }
  }

  async function handleAddAdmin() {
    if (!session) return
    const email = adminEmail.trim()
    if (!email) {
      setAdminMsg('أدخل البريد الإلكتروني')
      return
    }
    setAddingAdmin(true)
    setAdminMsg('')
    try {
      await subscriberAction(session.access_token, 'set-admin', { email })
      setAdminMsg(`✅ تم إضافة ${email} كأدمن`)
      setAdminEmail('')
      await load()
    } catch (e: any) {
      setAdminMsg(`خطأ: ${e?.message || 'فشل'}`)
    } finally {
      setAddingAdmin(false)
    }
  }

  async function handleActivate(s: Subscriber) {
    if (!session) return
    try {
      await subscriberAction(session.access_token, 'activate', { id: s.id })
      await load()
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل')
    }
  }

  async function handleRevoke(s: Subscriber) {
    if (!session) return
    Alert.alert('إلغاء الاشتراك', `إلغاء اشتراك ${s.email}؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تأكيد',
        style: 'destructive',
        onPress: async () => {
          try {
            await subscriberAction(session.access_token, 'revoke', { id: s.id })
            await load()
          } catch (e: any) {
            Alert.alert('خطأ', e?.message || 'فشل')
          }
        },
      },
    ])
  }

  async function handleDelete(s: Subscriber) {
    if (!session) return
    Alert.alert('حذف الحساب', `حذف حساب ${s.email} بالكامل؟ لا يمكن التراجع.`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSubscriber(session.access_token, s.id)
            setSubs(prev => prev.filter(x => x.id !== s.id))
          } catch (e: any) {
            Alert.alert('خطأ', e?.message || 'فشل الحذف')
          }
        },
      },
    ])
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>إدارة المستخدمين</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      ) : error ? (
        <View style={s.center}>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={load}>
            <Text style={s.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={s.listContent}
          ListHeaderComponent={
            <>
              {/* Stats */}
              <View style={s.statsRow}>
                <StatBox label="الكل" value={stats.total} color={Colors.text} />
                <StatBox label="برو" value={stats.pro} color={Colors.accent} />
                <StatBox label="تجربة" value={stats.trial} color={Colors.green} />
                <StatBox label="كريدت" value={stats.credits} color={Colors.gold} />
                <StatBox label="أدمن" value={stats.admin} color={Colors.purple} />
                <StatBox label="مجاني" value={stats.free} color={Colors.textMuted} />
              </View>

              {/* Manual grant form */}
              <View style={s.card}>
                <Text style={s.cardTitle}>➕ تفعيل مشترك يدوياً</Text>
                <TextInput
                  style={s.input}
                  value={grantEmail}
                  onChangeText={setGrantEmail}
                  placeholder="البريد الإلكتروني"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  textAlign="left"
                />
                <View style={s.grantBtnRow}>
                  <GrantBtn
                    label="⚡ كريدت"
                    color={Colors.gold}
                    loading={granting === 'grant-credits'}
                    onPress={() => handleGrant('grant-credits')}
                  />
                  <GrantBtn
                    label="✨ برو"
                    color={Colors.accent}
                    loading={granting === 'activate-annual'}
                    onPress={() => handleGrant('activate-annual')}
                  />
                  <GrantBtn
                    label="♾️ برو بلس"
                    color={Colors.purple}
                    loading={granting === 'activate'}
                    onPress={() => handleGrant('activate')}
                  />
                  <GrantBtn
                    label="🎁 تجربة"
                    color={Colors.green}
                    loading={granting === 'grant-trial'}
                    onPress={() => handleGrant('grant-trial')}
                  />
                </View>
                {grantMsg ? (
                  <Text style={[s.msg, grantMsg.startsWith('✅') && s.msgOk]}>{grantMsg}</Text>
                ) : null}
              </View>

              {/* Add admin form */}
              <View style={s.card}>
                <Text style={s.cardTitle}>👑 إضافة أدمن جديد</Text>
                <View style={s.addAdminRow}>
                  <TextInput
                    style={[s.input, { flex: 1, marginBottom: 0 }]}
                    value={adminEmail}
                    onChangeText={setAdminEmail}
                    placeholder="البريد الإلكتروني"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textAlign="left"
                  />
                  <TouchableOpacity style={s.addAdminBtn} onPress={handleAddAdmin} disabled={addingAdmin}>
                    {addingAdmin ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={s.addAdminBtnText}>إضافة</Text>
                    )}
                  </TouchableOpacity>
                </View>
                {adminMsg ? (
                  <Text style={[s.msg, adminMsg.startsWith('✅') && s.msgOk]}>{adminMsg}</Text>
                ) : null}
              </View>

              {/* Tabs */}
              <View style={s.tabRow}>
                {(['all', 'pro', 'credits', 'trial', 'free'] as TabFilter[]).map(tb => (
                  <TouchableOpacity
                    key={tb}
                    style={[s.tab, tab === tb && s.tabActive]}
                    onPress={() => setTab(tb)}
                  >
                    <Text style={[s.tabText, tab === tb && s.tabTextActive]}>
                      {{ all: 'الكل', pro: 'برو', credits: 'كريدت', trial: 'تجربة', free: 'مجاني' }[tb]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={s.search}
                value={search}
                onChangeText={setSearch}
                placeholder="🔍 ابحث بالإيميل..."
                placeholderTextColor={Colors.textMuted}
                textAlign="left"
                autoCapitalize="none"
              />
            </>
          }
          renderItem={({ item }) => {
            const kind = classify(item)
            return (
              <View style={s.row}>
                <View style={s.rowInfo}>
                  <Text style={s.rowEmail} numberOfLines={1}>{item.email}</Text>
                  <View style={[s.kindBadge, { backgroundColor: KIND_COLOR[kind] + '22', borderColor: KIND_COLOR[kind] }]}>
                    <Text style={[s.kindText, { color: KIND_COLOR[kind] }]}>
                      {kind === 'credits' ? `⚡ كريدت (${item.credits_remaining || 0})` : KIND_LABEL[kind]}
                    </Text>
                  </View>
                </View>
                <View style={s.rowActions}>
                  {kind === 'free' || kind === 'expiredPro' ? (
                    <TouchableOpacity style={s.actionBtn} onPress={() => handleActivate(item)}>
                      <Text style={s.actionBtnText}>تفعيل</Text>
                    </TouchableOpacity>
                  ) : kind !== 'admin' ? (
                    <TouchableOpacity style={[s.actionBtn, s.actionBtnRevoke]} onPress={() => handleRevoke(item)}>
                      <Text style={[s.actionBtnText, s.actionBtnRevokeText]}>إلغاء</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item)}>
                    <Ionicons name="trash" size={16} color={Colors.red} />
                  </TouchableOpacity>
                </View>
              </View>
            )
          }}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyText}>لا يوجد مستخدمون</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={s.statBox}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function GrantBtn({ label, color, loading, onPress }: { label: string; color: string; loading: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[s.grantBtn, { borderColor: color }]} onPress={onPress} disabled={loading}>
      {loading ? <ActivityIndicator color={color} size="small" /> : <Text style={[s.grantBtnText, { color }]}>{label}</Text>}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.gold, fontSize: FontSize.lg, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: Spacing.lg },
  errorText: { color: Colors.red, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.s2, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: Colors.text, fontWeight: '600' },
  emptyText: { color: Colors.textMuted, marginTop: Spacing.lg },
  listContent: { padding: Spacing.md, paddingTop: Spacing.md },
  statsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  statBox: {
    flexGrow: 1,
    minWidth: 90,
    backgroundColor: Colors.s1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  statValue: { fontSize: FontSize.lg, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  card: {
    backgroundColor: Colors.s1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  cardTitle: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700', textAlign: 'right', marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  grantBtnRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  grantBtn: {
    flexGrow: 1,
    minWidth: 80,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  grantBtnText: { fontSize: FontSize.xs, fontWeight: '700' },
  addAdminRow: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  addAdminBtn: {
    backgroundColor: Colors.purple,
    borderRadius: Radius.md,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAdminBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  msg: { color: Colors.red, fontSize: FontSize.xs, textAlign: 'center', marginTop: 8 },
  msgOk: { color: Colors.green },
  tabRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: Spacing.sm },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.s2,
  },
  tabActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  tabText: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '600' },
  tabTextActive: { color: Colors.bg, fontWeight: '800' },
  search: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: Colors.s1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginBottom: 8,
    gap: 8,
  },
  rowInfo: { flex: 1, gap: 6 },
  rowEmail: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600', textAlign: 'right' },
  kindBadge: {
    alignSelf: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  kindText: { fontSize: FontSize.xs, fontWeight: '700' },
  rowActions: { flexDirection: 'row-reverse', gap: 6, alignItems: 'center' },
  actionBtn: {
    backgroundColor: Colors.accent + '22',
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionBtnText: { color: Colors.accent, fontSize: FontSize.xs, fontWeight: '700' },
  actionBtnRevoke: { backgroundColor: Colors.red + '15', borderColor: Colors.red },
  actionBtnRevokeText: { color: Colors.red },
  deleteBtn: { padding: 6 },
})
