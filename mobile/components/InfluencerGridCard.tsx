import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { getTier, formatFollowers, getPrimaryPlatform, resolveImageUrl, Influencer } from '@/lib/api'
import { useLanguage } from '@/context/LanguageContext'
import { translateTier } from '@/lib/i18n'
import { Colors, FontSize, Radius, TierColors, PlatformColors } from '@/constants/theme'
import { cacheInfluencer } from '@/lib/influencerCache'

interface Props {
  influencer: Influencer
  onPress: () => void
}

export default function InfluencerGridCard({ influencer: inf, onPress }: Props) {
  const { tf, t, lang } = useLanguage()
  const tier = getTier(inf.totalFollowers)
  const tierLabel = translateTier(tier, lang)
  const tierColor = TierColors[tier] || Colors.textMuted
  const primary = getPrimaryPlatform(inf)
  const platformLabel = primary?.[0] || ''
  const platformColor = PlatformColors[platformLabel] || Colors.accent
  const avatarUrl = resolveImageUrl(inf.avatar)
  const name = tf(inf, 'name')

  function handlePress() {
    cacheInfluencer(inf)
    onPress()
  }

  return (
    <TouchableOpacity style={s.card} onPress={handlePress} activeOpacity={0.75}>
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={s.avatar} />
      ) : (
        <View style={s.avatarFallback}>
          <Text style={s.avatarInitial}>{name?.[0] || '?'}</Text>
        </View>
      )}

      <View style={s.nameRow}>
        {inf.source === 'verified' && <Text style={s.verified}>✓ </Text>}
        <Text style={s.name} numberOfLines={1}>{name}</Text>
      </View>

      <View style={[s.tierBadge, { backgroundColor: tierColor + '22', borderColor: tierColor }]}>
        <Text style={[s.tierText, { color: tierColor }]}>{tierLabel}</Text>
      </View>

      <Text style={s.followers}>{inf.totalFormatted || formatFollowers(inf.totalFollowers)} {t('followers')}</Text>

      {platformLabel ? (
        <View style={[s.platformDot, { backgroundColor: platformColor }]} />
      ) : null}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: Colors.s1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 12,
    alignItems: 'center',
    margin: 4,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.s3, marginBottom: 8 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.s3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarInitial: { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', maxWidth: '100%' },
  verified: { color: Colors.accent, fontSize: FontSize.xs },
  name: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700', textAlign: 'center' },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
    borderWidth: 1,
    marginTop: 6,
  },
  tierText: { fontSize: 10, fontWeight: '700' },
  followers: { color: Colors.gold, fontSize: FontSize.xs, fontWeight: '600', marginTop: 6 },
  platformDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
})
