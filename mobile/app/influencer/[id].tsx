import { useState } from 'react'
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { getTier, formatFollowers, formatPrice, resolveImageUrl, unlockInfluencer, Influencer } from '@/lib/api'
import { getCachedInfluencer } from '@/lib/influencerCache'
import { translateTier } from '@/lib/i18n'
import { Colors, Spacing, FontSize, Radius, TierColors, PlatformColors, PlatformIcons } from '@/constants/theme'

const { width } = Dimensions.get('window')
const COVER_H = 200

export default function InfluencerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session, subscriber, effectivePlan, refreshSubscriber } = useAuth()
  const { t, tf, tfList, lang } = useLanguage()
  const router = useRouter()
  const [justUnlockedIds, setJustUnlockedIds] = useState<string[]>([])
  const [unlocking, setUnlocking] = useState(false)
  const [unlockError, setUnlockError] = useState('')

  const inf: Influencer | null = getCachedInfluencer(id ?? '')

  if (!inf) {
    return (
      <SafeAreaView style={s.screen}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={s.center}>
          <Text style={{ color: Colors.textMuted }}>{t('notFound')}</Text>
        </View>
      </SafeAreaView>
    )
  }

  const tier = getTier(inf.totalFollowers)
  const tierColor = TierColors[tier] || Colors.textMuted
  const isPro = effectivePlan === 'pro' || effectivePlan === 'admin'
  const avatarUrl = resolveImageUrl(inf.avatar)
  const coverUrl = resolveImageUrl(inf.cover)
  const name = tf(inf, 'name')
  const specialization = tf(inf, 'specialization')
  const intro = tf(inf, 'intro')
  const categories = tfList(inf, 'categories')
  const tags = tfList(inf, 'tags')
  const regions = tfList(inf, 'regions')

  const isUnlocked =
    justUnlockedIds.includes(String(inf.id)) ||
    !!subscriber?.unlocked_ids?.includes(String(inf.id))

  async function handleUnlock() {
    if (!session || unlocking) return
    setUnlocking(true)
    setUnlockError('')
    try {
      await unlockInfluencer(session.access_token, inf!.id)
      setJustUnlockedIds(prev => [...prev, String(inf!.id)])
      await refreshSubscriber()
    } catch (e: any) {
      setUnlockError(e?.message || t('unlockFailed'))
    } finally {
      setUnlocking(false)
    }
  }

  if (effectivePlan === 'credits' && !isUnlocked) {
    const creditsLeft = subscriber?.credits_remaining || 0
    return (
      <SafeAreaView style={s.screen} edges={['top']}>
        <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={s.coverBox}>
            {coverUrl ? (
              <Image source={{ uri: coverUrl }} style={s.cover} resizeMode="cover" />
            ) : (
              <View style={[s.cover, { backgroundColor: Colors.s3 }]} />
            )}
            <View style={s.coverOverlay} />
            <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={s.heroSection}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarInitial}>{name?.[0] || '?'}</Text>
              </View>
            )}
            <View style={s.heroInfo}>
              <Text style={s.nameText}>{name}</Text>
              {specialization ? <Text style={s.specText}>{specialization}</Text> : null}
              <View style={s.badgeRow}>
                <View style={[s.badge, { backgroundColor: tierColor + '22', borderColor: tierColor }]}>
                  <Text style={[s.badgeText, { color: tierColor }]}>{translateTier(tier, lang)}</Text>
                </View>
                {inf.rank ? (
                  <View style={[s.badge, { backgroundColor: Colors.s2, borderColor: Colors.border }]}>
                    <Text style={[s.badgeText, { color: Colors.textMuted }]}>#{inf.rank}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          <View style={s.body}>
            <View style={s.unlockBanner}>
              <Text style={s.unlockTitle}>⚡ {t('unlockThis')}</Text>
              <Text style={s.unlockSub}>
                {t('youHave')} <Text style={{ color: Colors.gold, fontWeight: '800' }}>{creditsLeft}</Text> {t('creditsRemaining')}
              </Text>
              {unlockError ? <Text style={s.error}>{unlockError}</Text> : null}
              <TouchableOpacity
                style={[s.unlockBtn, (unlocking || creditsLeft <= 0) && s.unlockBtnDisabled]}
                onPress={handleUnlock}
                disabled={unlocking || creditsLeft <= 0}
              >
                <Text style={s.unlockBtnText}>
                  {unlocking ? `⏳ ${t('unlocking')}` : creditsLeft > 0 ? `🔓 ${t('unlockOneCredit')}` : `❌ ${t('noCreditsLeft')}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    )
  }

  const platforms = Object.entries(inf.platforms || {})
  // 0 = balanced, 1 = mostly-male audience, 2 = mostly-female audience.
  const femalePct = inf.followersGender === 2 ? 70 : inf.followersGender === 1 ? 30 : 50

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Cover */}
        <View style={s.coverBox}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={s.cover} resizeMode="cover" />
          ) : (
            <View style={[s.cover, { backgroundColor: Colors.s3 }]} />
          )}
          <View style={s.coverOverlay} />

          {/* Close button */}
          <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Avatar + name */}
        <View style={s.heroSection}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>{name?.[0] || '?'}</Text>
            </View>
          )}

          <View style={s.heroInfo}>
            <View style={s.nameRow}>
              {inf.source === 'verified' && <Text style={{ color: Colors.accent, marginLeft: 4 }}>✓</Text>}
              <Text style={s.nameText}>{name}</Text>
            </View>
            {specialization ? (
              <Text style={s.specText}>{specialization}</Text>
            ) : null}
            <View style={s.badgeRow}>
              <View style={[s.badge, { backgroundColor: tierColor + '22', borderColor: tierColor }]}>
                <Text style={[s.badgeText, { color: tierColor }]}>{translateTier(tier, lang)}</Text>
              </View>
              {inf.rank ? (
                <View style={[s.badge, { backgroundColor: Colors.s2, borderColor: Colors.border }]}>
                  <Text style={[s.badgeText, { color: Colors.textMuted }]}>#{inf.rank}</Text>
                </View>
              ) : null}
              {inf.rangeLabel ? (
                <View style={[s.badge, { backgroundColor: Colors.s2, borderColor: Colors.border }]}>
                  <Text style={[s.badgeText, { color: Colors.textMuted }]}>{inf.rangeLabel}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        <View style={s.body}>
          {/* Main stats */}
          <View style={s.statsRow}>
            <StatBox label={t('totalFollowers')} value={inf.totalFormatted || formatFollowers(inf.totalFollowers)} />
            <StatBox label={t('platforms')} value={String(platforms.length)} />
            <StatBox
              label={t('gender')}
              value={inf.gender === 'female' ? t('femaleOption') : inf.gender === 'male' ? t('maleOption') : '—'}
            />
          </View>

          {/* Audience gender distribution */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('audienceGender')}</Text>
            <View style={s.genderRow}>
              <GenderBar label={t('female')} pct={femalePct} color={Colors.purple} />
              <GenderBar label={t('male')} pct={100 - femalePct} color={Colors.accent} />
            </View>
          </View>

          {/* Bio */}
          {intro ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('bio')}</Text>
              <Text style={s.bioText}>{intro}</Text>
            </View>
          ) : null}

          {/* Follower age ranges */}
          {inf.followersAges?.length ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('followerAges')}</Text>
              <View style={s.tagWrap}>
                {inf.followersAges.map(a => (
                  <View key={a} style={s.tag}>
                    <Text style={s.tagText}>{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Platforms */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>{t('platforms')}</Text>
            {platforms.map(([name, p]) => (
              <PlatformCard key={name} name={name} data={p} isPro={isPro} t={t} />
            ))}
          </View>

          {!isPro ? (
            <View style={s.lockedBox}>
              <Text style={s.lockedIcon}>🔒</Text>
              <Text style={s.lockedText}>{t('proLockedText')}</Text>
            </View>
          ) : null}

          {/* Categories */}
          {categories.length ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('categories')}</Text>
              <View style={s.tagWrap}>
                {categories.map(c => (
                  <View key={c} style={s.tag}>
                    <Text style={s.tagText}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Tags */}
          {tags.length ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('tags')}</Text>
              <View style={s.tagWrap}>
                {tags.map(tg => (
                  <View key={tg} style={[s.tag, { backgroundColor: Colors.s3 }]}>
                    <Text style={s.tagText}>#{tg}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Regions */}
          {regions.length ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>{t('regions')}</Text>
              <View style={s.tagWrap}>
                {regions.map(r => (
                  <View key={r} style={[s.tag, { backgroundColor: Colors.accent + '22' }]}>
                    <Text style={[s.tagText, { color: Colors.accent }]}>📍 {r}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function PlatformCard({ name, data: p, isPro, t }: { name: string; data: Influencer['platforms'][string]; isPro: boolean; t: (key: import('@/lib/i18n').TKey) => string }) {
  const color = PlatformColors[name] || Colors.accent
  const stats: { label: string; value: string }[] = []
  if (p.avgLikes != null) stats.push({ label: t('avgLikes'), value: formatFollowers(p.avgLikes) })
  if (p.avgComments != null) stats.push({ label: t('avgComments'), value: String(p.avgComments) })
  if (p.engagementRate != null) stats.push({ label: t('engagementShort'), value: `${p.engagementRate}%` })
  if (p.postsPerWeek != null) stats.push({ label: t('postsWeek'), value: String(p.postsPerWeek) })
  const prices = p.prices ? Object.entries(p.prices) : []

  return (
    <View style={[s.platformCard, { borderColor: color + '55' }]}>
      <View style={s.platformHead}>
        <View style={s.platformHeadLeft}>
          <Text style={{ fontSize: 20 }}>{PlatformIcons[name] || '🔗'}</Text>
          <Text style={[s.platformName, { color }]}>{name}</Text>
        </View>
        <Text style={s.platformFollowers}>{p.followers}</Text>
      </View>

      {isPro && p.url ? (
        <TouchableOpacity style={s.profileLinkBtn} onPress={() => Linking.openURL(p.url!)}>
          <Text style={s.profileLinkText}>{t('viewProfile')} ←</Text>
        </TouchableOpacity>
      ) : null}

      {stats.length ? (
        <View style={s.platformStatsRow}>
          {stats.map(st => (
            <View key={st.label} style={s.platformStat}>
              <Text style={s.platformStatValue}>{st.value}</Text>
              <Text style={s.platformStatLabel}>{st.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {prices.length ? (
        <View style={s.priceGrid}>
          {prices.map(([label, value]) => (
            <PriceBox key={label} label={label} value={formatPrice(value)} />
          ))}
        </View>
      ) : null}
    </View>
  )
}

function StatBox({ label, value, color = Colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={s.statBox}>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function PriceBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.priceBox}>
      <Text style={s.priceValue}>{value}</Text>
      <Text style={s.priceLabel}>{label}</Text>
    </View>
  )
}

function GenderBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <View style={s.genderItem}>
      <Text style={[s.genderPct, { color }]}>{Math.round(pct)}%</Text>
      <View style={s.genderBarBg}>
        <View style={[s.genderBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={s.genderLabel}>{label}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  screen:        { flex: 1, backgroundColor: Colors.bg },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverBox:      { width, height: COVER_H, position: 'relative' },
  cover:         { width, height: COVER_H },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  closeBtn: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: {
    flexDirection: 'row-reverse',
    padding: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginTop: -40,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: Colors.bg,
    backgroundColor: Colors.s2,
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial:  { color: Colors.text, fontSize: FontSize.xl, fontWeight: '700' },
  heroInfo:       { flex: 1, justifyContent: 'flex-end', paddingBottom: 4 },
  nameRow:        { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  nameText:       { color: Colors.text, fontSize: FontSize.lg, fontWeight: '800', textAlign: 'right' },
  specText:       { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'right', marginTop: 2 },
  badgeRow:       { flexDirection: 'row-reverse', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeText:      { fontSize: FontSize.xs, fontWeight: '700' },
  body:           { padding: Spacing.md },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  statBox: {
    flex: 1,
    minWidth: 80,
    backgroundColor: Colors.s1,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue:      { color: Colors.text, fontSize: FontSize.lg, fontWeight: '800' },
  statLabel:      { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  section:        { marginBottom: Spacing.md },
  sectionTitle:   { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: '700', textAlign: 'right', marginBottom: 10 },
  bioText:        { color: Colors.text, fontSize: FontSize.sm, lineHeight: 22, textAlign: 'right' },
  platformCard: {
    backgroundColor: Colors.s1,
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.sm,
    marginBottom: 8,
  },
  platformHead: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  platformHeadLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  platformName:    { fontSize: FontSize.md, fontWeight: '700' },
  platformFollowers: { color: Colors.text, fontSize: FontSize.md, fontWeight: '800' },
  profileLinkBtn: {
    backgroundColor: Colors.accent + '22',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  profileLinkText: { color: Colors.accent, fontWeight: '600', fontSize: FontSize.sm },
  platformStatsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.sm,
  },
  platformStat: {
    minWidth: 70,
    backgroundColor: Colors.s2,
    borderRadius: Radius.sm,
    padding: 8,
    alignItems: 'center',
  },
  platformStatValue: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  platformStatLabel: { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  priceGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: Spacing.sm,
  },
  priceBox: {
    minWidth: '31%',
    backgroundColor: Colors.s2,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceValue:     { color: Colors.gold, fontSize: FontSize.sm, fontWeight: '800' },
  priceLabel:     { color: Colors.textMuted, fontSize: FontSize.xs, marginTop: 2 },
  lockedBox: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  lockedIcon:     { fontSize: 32 },
  lockedText:     { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center' },
  unlockBanner: {
    backgroundColor: Colors.gold + '15',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.gold + '55',
    padding: Spacing.lg,
    alignItems: 'center',
  },
  unlockTitle: { color: Colors.gold, fontSize: FontSize.lg, fontWeight: '800', marginBottom: 8 },
  unlockSub:   { color: Colors.text, fontSize: FontSize.sm, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.md },
  unlockBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  unlockBtnDisabled: { opacity: 0.5 },
  unlockBtnText: { color: Colors.bg, fontWeight: '800', fontSize: FontSize.sm },
  error:       { color: Colors.red, fontSize: FontSize.xs, textAlign: 'center', marginBottom: Spacing.sm },
  genderRow:      { gap: 12 },
  genderItem:     { gap: 4 },
  genderPct:      { fontSize: FontSize.md, fontWeight: '700', textAlign: 'right' },
  genderBarBg: {
    height: 8,
    backgroundColor: Colors.s3,
    borderRadius: 4,
    overflow: 'hidden',
  },
  genderBarFill:  { height: 8, borderRadius: 4 },
  genderLabel:    { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'right' },
  tagWrap:        { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText:        { color: Colors.text, fontSize: FontSize.xs },
})
