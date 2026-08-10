import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { fetchInfluencers, fetchCount, getTier, getPrimaryPlatform, getDisplayPrices, Influencer } from '@/lib/api'
import { flexRow, textAlign as textAlignFor } from '@/lib/rtl'
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'
import InfluencerCard from '@/components/InfluencerCard'
import InfluencerGridCard from '@/components/InfluencerGridCard'
import FilterSheet, { Filters } from '@/components/FilterSheet'
import TourGuide from '@/components/TourGuide'
import UpgradeModal from '@/components/UpgradeModal'

const LIMIT = 100
const VIEW_MODE_KEY = 'directory_view_mode'

export default function DirectoryScreen() {
  const { session, effectivePlan } = useAuth()
  const { lang, toggleLang, t, tf } = useLanguage()
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [totalCount, setTotalCount] = useState<number | null>(null)

  useEffect(() => {
    fetchCount().then(res => setTotalCount(res.count)).catch(() => {})
  }, [])

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

  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then(saved => {
      if (saved === 'grid' || saved === 'list') setViewMode(saved)
    })
  }, [])

  function changeViewMode(mode: 'list' | 'grid') {
    setViewMode(mode)
    AsyncStorage.setItem(VIEW_MODE_KEY, mode)
  }

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
      setError(`${t('couldNotLoadData')}\n${e?.message || ''}`)
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
        inf.tags_en?.some(t => t.toLowerCase().includes(q)) ||
        inf.categories?.some(c => c.toLowerCase().includes(q)) ||
        inf.categories_en?.some(c => c.toLowerCase().includes(q)),
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
        // Falls back to the same follower-based price estimate shown on the
        // detail screen for platforms with no real prices set, so
        // estimated-only influencers can still match a price range instead
        // of being silently excluded because their real prices object is empty.
        const allPrices = Object.entries(inf.platforms || {})
          .flatMap(([name, p]) => Object.values(getDisplayPrices(name, p).prices))
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
          <Text style={s.loadingText}>{t('loadingInfluencers')}</Text>
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
            <Text style={s.retryText}>{t('retry')}</Text>
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
          <TouchableOpacity onPress={toggleLang} style={s.helpBtn}>
            <Text style={s.helpBtnText}>{lang === 'ar' ? 'EN' : 'AR'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowTour(true)} style={s.helpBtn}>
            <Text style={s.helpBtnText}>❓</Text>
          </TouchableOpacity>
          {showUpgradeBtn ? (
            <TouchableOpacity style={s.upgradeBtn} onPress={() => setShowUpgrade(true)}>
              <Text style={s.upgradeBtnText}>⭐ {t('upgrade')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={[s.headerBrand, { flexDirection: flexRow(lang) }]}>
          <Image source={require('@/assets/logo.png')} style={s.headerLogo} resizeMode="contain" />
          <View>
            <Text style={s.headerTitle}>{t('appName')}</Text>
            <Text style={s.headerCount}>
              {filtered.length}/{totalCount ?? influencers.length} {t('influencersCount')}
            </Text>
          </View>
        </View>
      </View>

      {/* Search + Filter */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder={t('search')}
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
          textAlign={lang === 'ar' ? 'right' : 'left'}
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
        <View style={s.viewToggle}>
          <TouchableOpacity
            style={[s.viewToggleBtn, viewMode === 'list' && s.viewToggleBtnActive]}
            onPress={() => changeViewMode('list')}
          >
            <Ionicons name="list" size={16} color={viewMode === 'list' ? Colors.accent : Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.viewToggleBtn, viewMode === 'grid' && s.viewToggleBtnActive]}
            onPress={() => changeViewMode('grid')}
          >
            <Ionicons name="grid" size={16} color={viewMode === 'grid' ? Colors.accent : Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Results count */}
      {search || activeFilters > 0 ? (
        <Text style={[s.resultsCount, { textAlign: textAlignFor(lang) }]}>{filtered.length} {t('resultsCount')}</Text>
      ) : null}

      {/* List */}
      <FlatList
        key={viewMode}
        data={filtered}
        numColumns={viewMode === 'grid' ? 2 : 1}
        columnWrapperStyle={viewMode === 'grid' ? s.gridRow : undefined}
        keyExtractor={item => String(item.id)}
        renderItem={({ item }) => {
          const onPress = () => {
            if (isFree) {
              setShowUpgrade(true)
            } else {
              router.push(`/influencer/${item.id}`)
            }
          }
          return viewMode === 'grid' ? (
            <InfluencerGridCard influencer={item} onPress={onPress} />
          ) : (
            <InfluencerCard influencer={item} onPress={onPress} />
          )
        }}
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
            <Text style={s.emptyText}>{t('noResults')}</Text>
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
  headerBrand:     { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  headerLogo:      { width: 30, height: 30 },
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
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 3,
    gap: 2,
  },
  viewToggleBtn: { width: 32, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  viewToggleBtnActive: { backgroundColor: Colors.s3 },
  resultsCount:     { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'right', paddingHorizontal: Spacing.md, paddingBottom: 4 },
  listContent:      { padding: Spacing.md, paddingTop: 8 },
  gridRow:          { gap: 0 },
  loadMoreBox:      { padding: Spacing.lg, alignItems: 'center' },
  empty:            { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText:        { color: Colors.textMuted, fontSize: FontSize.md },
})
