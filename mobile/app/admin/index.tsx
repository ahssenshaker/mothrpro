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
import { fetchAllInfluencers, deleteInfluencer, Influencer } from '@/lib/api'
import { cacheInfluencer } from '@/lib/influencerCache'
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'
import ImportExportBar from '@/components/admin/ImportExportBar'

export default function AdminListScreen() {
  const { session } = useAuth()
  const router = useRouter()
  const [items, setItems] = useState<Influencer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const data = await fetchAllInfluencers(session.access_token)
      setItems(data)
    } catch (e: any) {
      setError(e?.message || 'تعذّر التحميل')
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? items.filter(d => (d.name + (d.specialization || '')).toLowerCase().includes(q))
      : items
    return [...list].sort((a, b) => (a.rank || 99999) - (b.rank || 99999))
  }, [items, search])

  function openEdit(inf: Influencer) {
    cacheInfluencer(inf)
    router.push(`/admin/${inf.id}`)
  }

  function openNew() {
    router.push('/admin/new')
  }

  async function handleDelete(inf: Influencer) {
    if (!session) return
    Alert.alert('حذف المؤثر', `هل أنت متأكد من حذف "${inf.name}"؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteInfluencer(session.access_token, inf.id)
            setItems(prev => prev.filter(x => x.id !== inf.id))
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
        <Text style={s.headerTitle}>لوحة تحكم الأدمن</Text>
        <TouchableOpacity onPress={openNew}>
          <Ionicons name="add-circle" size={26} color={Colors.gold} />
        </TouchableOpacity>
      </View>

      <ImportExportBar items={items} onImported={load} />

      <TextInput
        style={s.search}
        value={search}
        onChangeText={setSearch}
        placeholder="ابحث بالاسم أو التخصص..."
        placeholderTextColor={Colors.textMuted}
        textAlign="right"
      />

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
          keyExtractor={item => String(item.id)}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => openEdit(item)}>
              <View style={s.rowInfo}>
                <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.rowMeta} numberOfLines={1}>
                  #{item.rank || '-'} · {item.totalFormatted || item.totalFollowers} · {item.specialization || '—'}
                </Text>
              </View>
              <TouchableOpacity style={s.deleteBtn} onPress={() => handleDelete(item)}>
                <Ionicons name="trash" size={18} color={Colors.red} />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyText}>لا توجد نتائج</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
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
  search: {
    margin: Spacing.md,
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: Spacing.lg },
  errorText: { color: Colors.red, textAlign: 'center' },
  retryBtn: { backgroundColor: Colors.s2, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: Colors.text, fontWeight: '600' },
  emptyText: { color: Colors.textMuted },
  listContent: { padding: Spacing.md, paddingTop: 0 },
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
  rowInfo: { flex: 1 },
  rowName: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700', textAlign: 'right' },
  rowMeta: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'right', marginTop: 2 },
  deleteBtn: { padding: 8 },
})
