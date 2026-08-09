import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '@/context/AuthContext'
import { fetchInfluencers, getTier, getPrimaryPlatform, Influencer } from '@/lib/api'
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'
import InfluencerCard from '@/components/InfluencerCard'
import FilterSheet, { Filters } from '@/components/FilterSheet'
import TourGuide from '@/components/TourGuide'
import UpgradeModal from '@/components/UpgradeModal'

const LIMIT = 100

export default function DirectoryScreen() {
  const { session, effectivePlan } = useAuth()
  const router = useRouter()
  const isFree = effectivePlan === 'free'
  const isPro = effectivePlan === 'pro' || effectivePlan === 'admin'
  const showUpgradeBtn = effectivePlan === 'free' || effectivePlan === 'credits'

  const [influencers, setInfluencers] = useState<Influencer[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [filters, setFilters] = useState<Filters>({
    tier: '',
    platform: '',
    gender: '',
    sort: 'rank',
    priceMin: '',
    priceMax: '',
  })
  const [showTour, setShowTour] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  useEffect(() => {
    if (!session?.user?.id) return
    const key = `tour_seen_${session.user.id}`
    AsyncStorage.getItem(key).then(seen => {
      if (!seen) {
        setTimeout(() => setShowTour(true), 800)
        AsyncStorage.setItem(key, '1')
      }
    })
  }, [session?.user?.id])

  const load = useCallback(async (reset = false) => {
    if (!session) return
    const p = reset ? 1 : page
    try {
      const res = await fetchInfluencers(session.access_token, p, LIMIT)
      if (reset) {
        setInfluencers(res.data)
      } else {
        setInfluencers(prev => [...prev, ...res.data])
      }
      setHasMore(res.hasMore)
      setPage(p + 1)
    } catch (e: any) {
      setError(`تعذّر تحميل البيانات\n${e?.message || ''}`)
    }
  }, [session, page])

  useEffect(() => {
    load(true).finally(() => setLoading(false))
  }, [session])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    setPage(1)
    await load(true)
    setRefreshing(false)
  }, [session])

  const onLoadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return
    setLoadingMore(true)
    await load(false)
    setLoadingMore(false)
  }, [hasMore, loadingMore, load])

  const filtered = useMemo(() => {
    let list = influencers

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(inf =>
        inf.name?.toLowerCase().includes(q) ||
        inf.name_en?.toLowerCase().includes(q) ||
        inf.specialization?.toLowerCase().includes(q) ||
        inf.specialization_en?.toLowerCase().includes(q) ||
        inf.tags?.some(t => t.toLowerCase().includes(q)) ||
        inf.categories?.some(c => c.toLowerCase().includes(q)),
      )
    }

    if (filters.tier) {
      list = list.filter(inf => getTier(inf.totalFollowers) === filters.tier)
    }
    if (filters.platform) {
      list = list.filter(inf => Object.keys(inf.platforms || {}).includes(filters.platform))
    }
    if (filters.gender) {
      list = list.filter(inf => inf.gender === filters.gender)
    }
    if (isPro && (filters.priceMin || filters.priceMax)) {
      const min = Number(filters.priceMin) || 0
      const max = Number(filters.priceMax) || 0
      list = list.filter(inf => {
        const allPrices = Object.values(inf.platforms || {})
          .flatMap(p => Object.values(p.prices || {}))
          .map(Number)
          .filter(v => v > 0)
        if (!allPrices.length) return false
        if (min && max) return allPrices.some(p => p >= min && p <= max)
        if (min) return allPrices.some(p => p >= min)
        if (max) return allPrices.some(p => p <= max)
        return true
      })
    }

    return [...list].sort((a, b) => {
      if (filters.sort === 'followers') return b.totalFollowers - a.totalFollowers
      if (filters.sort === 'engagement') {
        const ea = getPrimaryPlatform(a)?.[1]?.engagementRate || 0
        const eb = getPrimaryPlatform(b)?.[1]?.engagementRate || 0
        return eb - ea
      }
      return (a.rank || 9999) - (b.rank || 9999)
    })
  }, [influencers, search, filters, isPro])

  const activeFilters =
    (filters.tier ? 1 : 0) +
    (filters.platform ? 1 : 0) +
    (filters.gender ? 1 : 0) +
    (isPro && (filters.priceMin || filters.priceMax) ? 1 : 0)

  if (loading) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <ActivityIndicator color={Colors.gold} size="large" />
          <Text style={s.loadingText}>جاري تحميل المؤثرين...</Text>
        </View>
      </SafeAreaView>
    )
  }

  if (error) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <Text style={{ fontSize: 48 }}>⚠️</Text>
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity
            style={s.retryBtn}
            onPress={() => { setError(''); setLoading(true); load(true).finally(() => setLoading(false)) }}
          >
            <Text style={s.retryText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.screen}>
      {/* Header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => setShowTour(true)} style={s.helpBtn}>
            <Text style={s.helpBtnText}>❓</Text>
          </TouchableOpacity>
          {showUpgradeBtn ? (
            <TouchableOpacity style={s.upgradeBtn} onPress={() => setShowUpgrade(true)}>
              <Text style={s.upgradeBtnText}>⭐ ترقية للبرو</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View>
          <Text style={s.headerTitle}>⭐ مؤثر برو</Text>
          <Text style={s.headerCount}>{influencers.length} مؤثر</Text>
        </View>
      </View>

      {/* Search + Filter */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث عن مؤثر..."
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
          textAlign="right"
        />
        <TouchableOpacity
          style={[s.filterBtn, activeFilters > 0 && s.filterBtnActive]}
          onPress={() => setShowFilter(true)}
        >
          <Ionicons name="options" size={20} color={activeFilters > 0 ? Colors.bg : Colors.text} />
          {activeFilters > 0 && (
            <View style={s.filterBadge}>
              <Text style={s.filterBadgeText}>{activeFilters}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Results count */}
      {search || activeFilters > 0 ? (
        <Text style={s.resultsCount}>{filtered.length} نتيجة</Text>
      ) : null}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => (
          <InfluencerCard
            influencer={item}
            onPress={() => {
              if (isFree) {
                setShowUpgrade(true)
              } else {
                router.push(`/influencer/${item.id}`)
              }
            }}
          />
        )}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.gold}
          />
        }
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={s.loadMoreBox}>
              <ActivityIndicator color={Colors.gold} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 48, textAlign: 'center' }}>🔍</Text>
            <Text style={s.emptyText}>لا توجد نتائج</Text>
          </View>
        }
      />

      <FilterSheet
        visible={showFilter}
        filters={filters}
        isPro={isPro}
        onApply={f => { setFilters(f); setShowFilter(false) }}
        onClose={() => setShowFilter(false)}
        onUpgradeRequest={() => { setShowFilter(false); setShowUpgrade(true) }}
      />

      <TourGuide visible={showTour} onClose={() => setShowTour(false)} />
      <UpgradeModal visible={showUpgrade} onClose={() => setShowUpgrade(false)} />
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen:          { flex: 1, backgroundColor: Colors.bg },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:     { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 8 },
  errorText:       { color: Colors.red, fontSize: FontSize.md, textAlign: 'center', marginTop: 8 },
  retryBtn:        { backgroundColor: Colors.s2, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  retryText:       { color: Colors.text, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle:     { color: Colors.gold, fontSize: FontSize.lg, fontWeight: '800' },
  headerCount:     { color: Colors.textMuted, fontSize: FontSize.sm },
  headerLeft:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  helpBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtnText:     { color: Colors.textMuted, fontSize: FontSize.xs },
  upgradeBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  upgradeBtnText:  { color: Colors.bg, fontWeight: '800', fontSize: FontSize.xs },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    padding: Spacing.md,
    paddingBottom: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'right',
  },
  filterBtn: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterBtnActive:  { backgroundColor: Colors.gold, borderColor: Colors.gold },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.red,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText:  { color: '#fff', fontSize: 9, fontWeight: '700' },
  resultsCount:     { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'right', paddingHorizontal: Spacing.md, paddingBottom: 4 },
  listContent:      { padding: Spacing.md, paddingTop: 8 },
  loadMoreBox:      { padding: Spacing.lg, alignItems: 'center' },
  empty:            { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:        { color: Colors.textMuted, fontSize: FontSize.md },
})
