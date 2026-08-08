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
import { getTier, formatFollowers, formatPrice, Influencer } from '@/lib/api'
import { getCachedInfluencer } from '@/lib/influencerCache'
import { Colors, Spacing, FontSize, Radius, TierColors, PlatformColors } from '@/constants/theme'

const { width } = Dimensions.get('window')
const COVER_H = 200

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'انستقرام',
  tiktok: 'تيك توك',
  youtube: 'يوتيوب',
  snapchat: 'سناب شات',
  twitter: 'تويتر',
  x: 'تويتر/X',
  facebook: 'فيسبوك',
}

export default function InfluencerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { effectivePlan } = useAuth()
  const router = useRouter()

  const inf: Influencer | null = getCachedInfluencer(id ?? '')

  if (!inf) {
    return (
      <SafeAreaView style={s.screen}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={s.center}>
          <Text style={{ color: Colors.textMuted }}>لم يتم العثور على المؤثر</Text>
        </View>
      </SafeAreaView>
    )
  }

  const tier = getTier(inf.followers)
  const tierColor = TierColors[tier] || Colors.textMuted
  const platform = inf.platform?.toLowerCase() || ''
  const platformColor = PlatformColors[platform] || Colors.accent
  const platformLabel = PLATFORM_LABEL[platform] || inf.platform || ''
  const isPro = effectivePlan === 'pro' || effectivePlan === 'admin'

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <ScrollView bounces={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Cover */}
        <View style={s.coverBox}>
          {inf.cover_url ? (
            <Image source={{ uri: inf.cover_url }} style={s.cover} resizeMode="cover" />
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
          {inf.avatar_url ? (
            <Image source={{ uri: inf.avatar_url }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>{inf.name?.[0] || '?'}</Text>
            </View>
          )}

          <View style={s.heroInfo}>
            <View style={s.nameRow}>
              {inf.verified && <Text style={{ color: Colors.accent, marginLeft: 4 }}>✓</Text>}
              <Text style={s.nameText}>{inf.name}</Text>
            </View>
            {inf.specialization ? (
              <Text style={s.specText}>{inf.specialization}</Text>
            ) : null}
            <View style={s.badgeRow}>
              <View style={[s.badge, { backgroundColor: tierColor + '22', borderColor: tierColor }]}>
                <Text style={[s.badgeText, { color: tierColor }]}>{tier}</Text>
              </View>
              <View style={[s.badge, { backgroundColor: platformColor + '22', borderColor: platformColor }]}>
                <Text style={[s.badgeText, { color: platformColor }]}>{platformLabel}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={s.body}>
          {/* Main stats */}
          <View style={s.statsRow}>
            <StatBox label="المتابعون" value={formatFollowers(inf.followers)} />
            {isPro && inf.engagement_rate != null && (
              <StatBox
                label="التفاعل"
                value={`${inf.engagement_rate.toFixed(1)}%`}
                color={Colors.green}
              />
            )}
            {isPro && inf.posts_per_week != null && (
              <StatBox label="بوست/أسبوع" value={`${inf.posts_per_week}`} />
            )}
            {isPro && inf.avg_likes != null && (
              <StatBox label="إعجابات" value={formatFollowers(inf.avg_likes)} />
            )}
          </View>

          {/* Bio */}
          {inf.intro ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>نبذة</Text>
              <Text style={s.bioText}>{inf.intro}</Text>
            </View>
          ) : null}

          {/* Profile URL */}
          {isPro && inf.profile_url ? (
            <TouchableOpacity
              style={s.profileLinkBtn}
              onPress={() => Linking.openURL(inf.profile_url!)}
            >
              <Text style={s.profileLinkText}>عرض الملف الشخصي ←</Text>
            </TouchableOpacity>
          ) : null}

          {/* Prices */}
          {isPro && inf.prices ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>الأسعار</Text>
              <View style={s.priceGrid}>
                {inf.prices.story != null && (
                  <PriceBox label="ستوري" value={formatPrice(inf.prices.story)} />
                )}
                {inf.prices.post != null && (
                  <PriceBox label="بوست" value={formatPrice(inf.prices.post)} />
                )}
                {inf.prices.reel != null && (
                  <PriceBox label="ريل" value={formatPrice(inf.prices.reel)} />
                )}
                {inf.prices.video != null && (
                  <PriceBox label="فيديو" value={formatPrice(inf.prices.video)} />
                )}
              </View>
            </View>
          ) : !isPro ? (
            <View style={s.lockedBox}>
              <Text style={s.lockedIcon}>🔒</Text>
              <Text style={s.lockedText}>الأسعار والإحصاءات التفصيلية متاحة لمشتركي برو فقط</Text>
            </View>
          ) : null}

          {/* Audience gender */}
          {isPro && inf.followers_gender ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>الجمهور</Text>
              <View style={s.genderRow}>
                <GenderBar label="إناث" pct={inf.followers_gender.female || 0} color={Colors.purple} />
                <GenderBar label="ذكور" pct={inf.followers_gender.male || 0} color={Colors.accent} />
              </View>
            </View>
          ) : null}

          {/* Categories */}
          {inf.categories?.length ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>التخصصات</Text>
              <View style={s.tagWrap}>
                {inf.categories.map(c => (
                  <View key={c} style={s.tag}>
                    <Text style={s.tagText}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Tags */}
          {inf.tags?.length ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>الوسوم</Text>
              <View style={s.tagWrap}>
                {inf.tags.map(t => (
                  <View key={t} style={[s.tag, { backgroundColor: Colors.s3 }]}>
                    <Text style={s.tagText}>#{t}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Regions */}
          {inf.regions?.length ? (
            <View style={s.section}>
              <Text style={s.sectionTitle}>المناطق</Text>
              <View style={s.tagWrap}>
                {inf.regions.map(r => (
                  <View key={r} style={[s.tag, { backgroundColor: Colors.accent + '22' }]}>
                    <Text style={[s.tagText, { color: Colors.accent }]}>{r}</Text>
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
  badgeRow:       { flexDirection: 'row-reverse', gap: 6, marginTop: 8 },
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
  profileLinkBtn: {
    backgroundColor: Colors.accent + '22',
    borderRadius: Radius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  profileLinkText: { color: Colors.accent, fontWeight: '600', fontSize: FontSize.sm },
  priceGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceBox: {
    width: '48%',
    backgroundColor: Colors.s2,
    borderRadius: Radius.sm,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceValue:     { color: Colors.gold, fontSize: FontSize.md, fontWeight: '800' },
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
