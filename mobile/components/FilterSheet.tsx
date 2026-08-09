import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native'
import { Colors, Spacing, FontSize, Radius, TierColors, PlatformColors } from '@/constants/theme'
import { useState } from 'react'
import { useLanguage } from '@/context/LanguageContext'
import { translateTier } from '@/lib/i18n'

export interface Filters {
  tier: string
  platform: string
  gender: string
  sort: 'rank' | 'followers' | 'engagement'
  priceMin: string
  priceMax: string
}

interface Props {
  visible: boolean
  filters: Filters
  isPro: boolean
  onApply: (f: Filters) => void
  onClose: () => void
  onUpgradeRequest: () => void
}

const TIERS = ['', 'نانو', 'ميكرو', 'ماكرو', 'ميجا', 'ألفا']
// These match the actual platform names stored in influencers.platforms
// (see index.html's PI map), not English slugs.
const PLATFORMS = ['', 'انستقرام', 'تيك توك', 'يوتيوب', 'سناب شات', 'تويتر/X', 'فيسبوك']
const PLATFORM_LABELS: Record<string, string> = {
  '': 'الكل',
  'انستقرام': 'انستقرام',
  'تيك توك': 'تيك توك',
  'يوتيوب': 'يوتيوب',
  'سناب شات': 'سناب شات',
  'تويتر/X': 'تويتر/X',
  'فيسبوك': 'فيسبوك',
}
export default function FilterSheet({ visible, filters, isPro, onApply, onClose, onUpgradeRequest }: Props) {
  const { t, lang } = useLanguage()
  const [local, setLocal] = useState<Filters>({ ...filters })

  const TIER_LABELS: Record<string, string> = {
    '': t('all'),
    نانو: translateTier('نانو', lang),
    ميكرو: translateTier('ميكرو', lang),
    ماكرو: translateTier('ماكرو', lang),
    ميجا: translateTier('ميجا', lang),
    ألفا: translateTier('ألفا', lang),
  }
  const SORTS: { value: Filters['sort']; label: string }[] = [
    { value: 'rank', label: t('sortRankShort') },
    { value: 'followers', label: t('sortFollowersShort') },
    { value: 'engagement', label: t('sortEngagementShort') },
  ]

  function reset() {
    setLocal({ tier: '', platform: '', gender: '', sort: 'rank', priceMin: '', priceMax: '' })
  }

  function apply() {
    onApply(local)
  }

  function handlePriceFocus() {
    if (isPro) return
    onUpgradeRequest()
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.backdrop} />
      </TouchableWithoutFeedback>

      <View style={s.sheet}>
        {/* Handle */}
        <View style={s.handle} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={reset}>
            <Text style={s.resetText}>{t('reset')}</Text>
          </TouchableOpacity>
          <Text style={s.title}>{t('filterAndSort')}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Sort */}
          <Text style={s.sectionTitle}>{t('sort')}</Text>
          <View style={s.chipRow}>
            {SORTS.map(opt => (
              <Chip
                key={opt.value}
                label={opt.label}
                active={local.sort === opt.value}
                color={Colors.accent}
                onPress={() => setLocal(f => ({ ...f, sort: opt.value }))}
              />
            ))}
          </View>

          {/* Tier */}
          <Text style={s.sectionTitle}>{t('tier')}</Text>
          <View style={s.chipRow}>
            {TIERS.map(tier => (
              <Chip
                key={tier || 'all'}
                label={TIER_LABELS[tier]}
                active={local.tier === tier}
                color={tier ? TierColors[tier] : Colors.textMuted}
                onPress={() => setLocal(f => ({ ...f, tier }))}
              />
            ))}
          </View>

          {/* Platform */}
          <Text style={s.sectionTitle}>{t('platform')}</Text>
          <View style={s.chipRow}>
            {PLATFORMS.map(p => (
              <Chip
                key={p || 'all'}
                label={p ? PLATFORM_LABELS[p] : t('all')}
                active={local.platform === p}
                color={p ? PlatformColors[p] : Colors.textMuted}
                onPress={() => setLocal(f => ({ ...f, platform: p }))}
              />
            ))}
          </View>

          {/* Gender */}
          <Text style={s.sectionTitle}>{t('gender')}</Text>
          <View style={s.chipRow}>
            {[
              { value: '', label: t('all') },
              { value: 'male', label: t('maleOption') },
              { value: 'female', label: t('femaleOption') },
            ].map(opt => (
              <Chip
                key={opt.value || 'all'}
                label={opt.label}
                active={local.gender === opt.value}
                color={Colors.purple}
                onPress={() => setLocal(f => ({ ...f, gender: opt.value }))}
              />
            ))}
          </View>

          {/* Price range — Pro only */}
          <View style={s.priceTitleRow}>
            <Text style={s.sectionTitle}>{t('priceRange')}</Text>
            {!isPro && <Text style={s.lockIcon}>🔒</Text>}
          </View>
          <View style={s.priceRow}>
            <TextInput
              style={s.priceInput}
              value={local.priceMax}
              onChangeText={v => setLocal(f => ({ ...f, priceMax: v }))}
              onFocus={handlePriceFocus}
              editable={isPro}
              placeholder={t('priceTo')}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              textAlign={lang === 'ar' ? 'right' : 'left'}
            />
            <TextInput
              style={s.priceInput}
              value={local.priceMin}
              onChangeText={v => setLocal(f => ({ ...f, priceMin: v }))}
              onFocus={handlePriceFocus}
              editable={isPro}
              placeholder={t('priceFrom')}
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              textAlign={lang === 'ar' ? 'right' : 'left'}
            />
          </View>
          {!isPro && (
            <TouchableOpacity onPress={onUpgradeRequest}>
              <Text style={s.priceGateText}>🔒 {t('priceGateText')}</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Apply button */}
        <TouchableOpacity style={s.applyBtn} onPress={apply}>
          <Text style={s.applyText}>{t('apply')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

function Chip({
  label,
  active,
  color,
  onPress,
}: {
  label: string
  active: boolean
  color: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        s.chip,
        active && { backgroundColor: color, borderColor: color },
      ]}
    >
      <Text style={[s.chipText, active && { color: Colors.bg, fontWeight: '700' }]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  backdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: Colors.s1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.md,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title:       { color: Colors.text, fontSize: FontSize.md, fontWeight: '700' },
  resetText:   { color: Colors.red, fontSize: FontSize.sm, fontWeight: '600' },
  closeText:   { color: Colors.textMuted, fontSize: FontSize.lg },
  sectionTitle:{ color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textAlign: 'right', marginBottom: 8, marginTop: Spacing.sm },
  chipRow:     { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.s2,
  },
  chipText:    { color: Colors.text, fontSize: FontSize.sm },
  priceTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  lockIcon:    { fontSize: FontSize.xs },
  priceRow:    { flexDirection: 'row-reverse', gap: 8, marginBottom: 4 },
  priceInput: {
    flex: 1,
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priceGateText: { color: Colors.accent, fontSize: FontSize.xs, textAlign: 'right', marginTop: 6 },
  applyBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  applyText:   { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },
})
