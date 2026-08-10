import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native'
import { getTier, formatFollowers, getPrimaryPlatform, resolveImageUrl, Influencer } from '@/lib/api'
import { useLanguage } from '@/context/LanguageContext'
import { translateTier, translatePlatform } from '@/lib/i18n'
import { flexRow, textAlign as textAlignFor } from '@/lib/rtl'
import { Colors, FontSize, Radius, TierColors, PlatformColors } from '@/constants/theme'
import { cacheInfluencer } from '@/lib/influencerCache'

interface Props {
  influencer: Influencer
  onPress: () => void
}

export default function InfluencerCard({ influencer: inf, onPress }: Props) {
  const { tf, tfList, t, lang } = useLanguage()
  const tier = getTier(inf.totalFollowers)
  const tierLabel = translateTier(tier, lang)
  const tierColor = TierColors[tier] || Colors.textMuted
  const primary = getPrimaryPlatform(inf)
  const platformLabel = primary?.[0] || ''
  const platformColor = PlatformColors[platformLabel] || Colors.accent
  const platformDisplay = translatePlatform(platformLabel, lang)
  const avatarUrl = resolveImageUrl(inf.avatar)
  const name = tf(inf, 'name')
  const specialization = tf(inf, 'specialization')
  const tags = tfList(inf, 'tags')

  function handlePress() {
    cacheInfluencer(inf)
    onPress()
  }

  return (
    <TouchableOpacity style={s.card} onPress={handlePress} activeOpacity={0.75}>
      <View style={[s.row, { flexDirection: flexRow(lang) }]}>
        {/* Text info on the reading-start side, avatar on the reading-end side */}
        <View style={s.info}>
          <View style={[s.nameRow, { flexDirection: flexRow(lang) }]}>
            {inf.source === 'verified' && <Text style={s.verified}> ✓</Text>}
            <Text style={[s.name, { textAlign: textAlignFor(lang) }]} numberOfLines={1}>{name}</Text>
          </View>
          {specialization ? (
            <Text style={[s.spec, { textAlign: textAlignFor(lang) }]} numberOfLines={1}>{specialization}</Text>
          ) : null}

          <View style={[s.badgeRow, { flexDirection: flexRow(lang) }]}>
            <View style={[s.badge, { backgroundColor: tierColor + '22', borderColor: tierColor }]}>
              <Text style={[s.badgeText, { color: tierColor }]}>{tierLabel}</Text>
            </View>
            {platformLabel ? (
              <View style={[s.badge, { backgroundColor: platformColor + '22', borderColor: platformColor }]}>
                <Text style={[s.badgeText, { color: platformColor }]}>{platformDisplay}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[s.followers, { textAlign: textAlignFor(lang) }]}>
            {inf.totalFormatted || formatFollowers(inf.totalFollowers)}{' '}
            <Text style={s.followersLabel}>{t('followers')}</Text>
          </Text>
        </View>

        {/* Avatar */}
        <View style={s.avatarBox}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatar} />
          ) : (
            <View style={s.avatarFallback}>
              <Text style={s.avatarInitial}>{name?.[0] || '?'}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Tags */}
      {tags.length ? (
        <View style={[s.tagRow, { flexDirection: flexRow(lang) }]}>
          {tags.slice(0, 3).map(tag => (
            <View key={tag} style={s.tag}>
              <Text style={s.tagText}>#{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  card: {
    backgroundColor: Colors.s1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    marginBottom: 8,
  },
  row:           { flexDirection: 'row-reverse', gap: 12, alignItems: 'flex-start' },
  info:          { flex: 1 },
  nameRow:       { flexDirection: 'row-reverse', alignItems: 'center' },
  name:          { color: Colors.text, fontSize: FontSize.md, fontWeight: '700', textAlign: 'right', flex: 1 },
  verified:      { color: Colors.accent, fontSize: FontSize.sm },
  spec:          { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'right', marginTop: 2 },
  badgeRow:      { flexDirection: 'row-reverse', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  badgeText:     { fontSize: FontSize.xs, fontWeight: '700' },
  followers:     { color: Colors.gold, fontSize: FontSize.sm, fontWeight: '700', marginTop: 6, textAlign: 'right' },
  followersLabel:{ color: Colors.textMuted, fontWeight: '400' },
  avatarBox:     { flexShrink: 0 },
  avatar:        { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.s3 },
  avatarFallback:{
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  tagRow:        { flexDirection: 'row-reverse', gap: 6, marginTop: 10, flexWrap: 'wrap' },
  tag:           { backgroundColor: Colors.s2, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  tagText:       { color: Colors.textMuted, fontSize: FontSize.xs },
})
