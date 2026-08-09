import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '@/context/AuthContext'
import { createInfluencer, updateInfluencer, Influencer, PlatformData, formatFollowers } from '@/lib/api'
import { getCachedInfluencer } from '@/lib/influencerCache'
import { Colors, Spacing, FontSize, Radius, PlatformIcons } from '@/constants/theme'

const PLATFORM_NAMES = ['انستقرام', 'تيك توك', 'يوتيوب', 'سناب شات', 'تويتر/X', 'فيسبوك']

function splitList(v: string): string[] {
  return v.split(/[،,]/).map(x => x.trim()).filter(Boolean)
}
function joinList(v?: string[]): string {
  return (v || []).join('، ')
}
function pricesToLines(prices?: Record<string, string> | null): string {
  return Object.entries(prices || {}).map(([k, v]) => `${k}:${v}`).join('\n')
}
function linesToPrices(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  text.split(/\n+/).map(x => x.trim()).filter(Boolean).forEach(line => {
    const idx = line.indexOf(':')
    if (idx > -1) {
      const k = line.slice(0, idx).trim()
      const v = line.slice(idx + 1).trim()
      if (k) out[k] = v
    }
  })
  return out
}

type PlatformEntry = { name: string; data: PlatformData; pricesText: string }

function platformsToEntries(platforms?: Record<string, PlatformData>): PlatformEntry[] {
  return Object.entries(platforms || {}).map(([name, data]) => ({
    name,
    data,
    pricesText: pricesToLines(data.prices),
  }))
}

export default function AdminEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { session } = useAuth()
  const router = useRouter()
  const isNew = id === 'new'
  const existing = isNew ? null : getCachedInfluencer(id ?? '')

  const [name, setName] = useState(existing?.name || '')
  const [nickname, setNickname] = useState(existing?.nickname || '')
  const [specialization, setSpecialization] = useState(existing?.specialization || '')
  const [gender, setGender] = useState(existing?.gender || '')
  const [source, setSource] = useState(existing?.source || 'verified')
  const [followersGender, setFollowersGender] = useState(existing?.followersGender ?? 0)
  const [intro, setIntro] = useState(existing?.intro || '')
  const [sourceNote, setSourceNote] = useState(existing?.sourceNote || '')
  const [avatar, setAvatar] = useState(existing?.avatar || '')
  const [cover, setCover] = useState(existing?.cover || '')
  const [categories, setCategories] = useState(joinList(existing?.categories))
  const [tags, setTags] = useState(joinList(existing?.tags))
  const [regions, setRegions] = useState(joinList(existing?.regions))
  const [ages, setAges] = useState(joinList(existing?.followersAges))
  const [nameEn, setNameEn] = useState(existing?.name_en || '')
  const [specializationEn, setSpecializationEn] = useState(existing?.specialization_en || '')
  const [introEn, setIntroEn] = useState(existing?.intro_en || '')
  const [categoriesEn, setCategoriesEn] = useState(joinList(existing?.categories_en))
  const [tagsEn, setTagsEn] = useState(joinList(existing?.tags_en))
  const [regionsEn, setRegionsEn] = useState(joinList(existing?.regions_en))
  const [platforms, setPlatforms] = useState<PlatformEntry[]>(platformsToEntries(existing?.platforms))
  const [saving, setSaving] = useState(false)

  function addPlatform() {
    setPlatforms(prev => [
      ...prev,
      {
        name: PLATFORM_NAMES.find(n => !prev.some(p => p.name === n)) || PLATFORM_NAMES[0],
        data: { followers: '', followersNum: 0, url: '', avgLikes: null, avgComments: null, engagementRate: null, postsPerWeek: null, prices: null },
        pricesText: '',
      },
    ])
  }

  function updatePlatform(idx: number, patch: Partial<PlatformEntry['data']>) {
    setPlatforms(prev => prev.map((p, i) => (i === idx ? { ...p, data: { ...p.data, ...patch } } : p)))
  }

  function removePlatform(idx: number) {
    setPlatforms(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!session) return
    if (!name.trim()) {
      Alert.alert('خطأ', 'اسم المؤثر مطلوب')
      return
    }
    setSaving(true)
    try {
      const platformsObj: Record<string, PlatformData> = {}
      platforms.forEach(p => {
        platformsObj[p.name] = {
          ...p.data,
          followers: p.data.followers || formatFollowers(p.data.followersNum),
          prices: Object.keys(linesToPrices(p.pricesText)).length ? linesToPrices(p.pricesText) : null,
        }
      })

      const payload: Partial<Influencer> = {
        name: name.trim(),
        nickname: nickname.trim(),
        specialization: specialization.trim(),
        gender,
        source,
        followersGender,
        intro: intro.trim(),
        sourceNote: sourceNote.trim(),
        avatar: avatar.trim(),
        cover: cover.trim(),
        categories: splitList(categories),
        tags: splitList(tags),
        regions: splitList(regions),
        followersAges: splitList(ages),
        name_en: nameEn.trim(),
        specialization_en: specializationEn.trim(),
        intro_en: introEn.trim(),
        categories_en: splitList(categoriesEn),
        tags_en: splitList(tagsEn),
        regions_en: splitList(regionsEn),
        platforms: platformsObj,
      }

      if (isNew) {
        await createInfluencer(session.access_token, payload)
      } else {
        await updateInfluencer(session.access_token, existing!.id, payload)
      }
      router.back()
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  if (!isNew && !existing) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.center}>
          <Text style={{ color: Colors.textMuted }}>لم يتم العثور على المؤثر</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.screen}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isNew ? 'إضافة مؤثر' : 'تعديل مؤثر'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Field label="اسم المؤثر *" value={name} onChangeText={setName} placeholder="مثال: أحمد محمد" />
        <Field label="اللقب / المعرف" value={nickname} onChangeText={setNickname} />
        <Field label="التخصص" value={specialization} onChangeText={setSpecialization} />

        <Text style={s.sectionTitle}>نبذة</Text>
        <TextInput style={[s.input, s.textarea]} value={intro} onChangeText={setIntro} multiline textAlign="right" />

        <Field label="ملاحظة المصدر / التحقق" value={sourceNote} onChangeText={setSourceNote} />
        <Field label="رابط الصورة الشخصية" value={avatar} onChangeText={setAvatar} placeholder="https://..." />
        <Field label="رابط صورة الغلاف" value={cover} onChangeText={setCover} placeholder="https://..." />

        <Text style={s.sectionTitle}>التخصصات (عربي، افصل بفاصلة)</Text>
        <TextInput style={s.input} value={categories} onChangeText={setCategories} textAlign="right" />
        <Text style={s.sectionTitle}>الوسوم (عربي)</Text>
        <TextInput style={s.input} value={tags} onChangeText={setTags} textAlign="right" />
        <Text style={s.sectionTitle}>المناطق (عربي)</Text>
        <TextInput style={s.input} value={regions} onChangeText={setRegions} textAlign="right" />
        <Text style={s.sectionTitle}>أعمار المتابعين</Text>
        <TextInput style={s.input} value={ages} onChangeText={setAges} placeholder="18-24، 25-34" textAlign="right" />

        <Text style={s.sectionTitle}>الاسم (إنجليزي)</Text>
        <TextInput style={s.input} value={nameEn} onChangeText={setNameEn} textAlign="left" />
        <Text style={s.sectionTitle}>التخصص (إنجليزي)</Text>
        <TextInput style={s.input} value={specializationEn} onChangeText={setSpecializationEn} textAlign="left" />
        <Text style={s.sectionTitle}>نبذة (إنجليزي)</Text>
        <TextInput style={[s.input, s.textarea]} value={introEn} onChangeText={setIntroEn} multiline textAlign="left" />
        <Text style={s.sectionTitle}>التخصصات (إنجليزي)</Text>
        <TextInput style={s.input} value={categoriesEn} onChangeText={setCategoriesEn} textAlign="left" />
        <Text style={s.sectionTitle}>الوسوم (إنجليزي)</Text>
        <TextInput style={s.input} value={tagsEn} onChangeText={setTagsEn} textAlign="left" />
        <Text style={s.sectionTitle}>المناطق (إنجليزي)</Text>
        <TextInput style={s.input} value={regionsEn} onChangeText={setRegionsEn} textAlign="left" />

        <Text style={s.sectionTitle}>الجنس</Text>
        <ChipRow
          options={[{ v: '', l: 'غير محدد' }, { v: 'male', l: 'ذكر' }, { v: 'female', l: 'أنثى' }]}
          value={gender}
          onChange={setGender}
        />

        <Text style={s.sectionTitle}>مصدر البيانات</Text>
        <ChipRow
          options={[{ v: 'verified', l: 'محدث/مضاف مؤكد' }, { v: 'moalen', l: 'موثّق' }]}
          value={source}
          onChange={setSource}
        />

        <Text style={s.sectionTitle}>توزيع المتابعين</Text>
        <ChipRow
          options={[{ v: 0, l: 'متوازن' }, { v: 1, l: 'ذكور أكثر' }, { v: 2, l: 'إناث أكثر' }]}
          value={followersGender}
          onChange={setFollowersGender}
        />

        {/* Platforms */}
        <View style={s.platformsHeader}>
          <TouchableOpacity onPress={addPlatform}>
            <Text style={s.addPlatformText}>+ إضافة منصة</Text>
          </TouchableOpacity>
          <Text style={s.sectionTitle}>المنصات</Text>
        </View>

        {platforms.map((p, idx) => (
          <View key={idx} style={s.platformBox}>
            <View style={s.platformHead}>
              <TouchableOpacity onPress={() => removePlatform(idx)}>
                <Text style={s.removeText}>حذف</Text>
              </TouchableOpacity>
              <Text style={s.platformName}>{PlatformIcons[p.name] || '🔗'} {p.name}</Text>
            </View>

            <ChipRow
              options={PLATFORM_NAMES.map(n => ({ v: n, l: n }))}
              value={p.name}
              onChange={v => setPlatforms(prev => prev.map((x, i) => (i === idx ? { ...x, name: String(v) } : x)))}
            />

            <Field
              label="عدد المتابعين"
              value={String(p.data.followersNum || '')}
              onChangeText={v => updatePlatform(idx, { followersNum: Number(v) || 0 })}
              keyboardType="number-pad"
            />
            <Field
              label="رابط الحساب"
              value={p.data.url || ''}
              onChangeText={v => updatePlatform(idx, { url: v })}
              placeholder="https://..."
            />
            <View style={s.statsRow}>
              <Field
                label="متوسط الإعجابات"
                style={s.statField}
                value={p.data.avgLikes != null ? String(p.data.avgLikes) : ''}
                onChangeText={v => updatePlatform(idx, { avgLikes: v ? Number(v) : null })}
                keyboardType="number-pad"
              />
              <Field
                label="متوسط التعليقات"
                style={s.statField}
                value={p.data.avgComments != null ? String(p.data.avgComments) : ''}
                onChangeText={v => updatePlatform(idx, { avgComments: v ? Number(v) : null })}
                keyboardType="number-pad"
              />
            </View>
            <View style={s.statsRow}>
              <Field
                label="نسبة التفاعل %"
                style={s.statField}
                value={p.data.engagementRate != null ? String(p.data.engagementRate) : ''}
                onChangeText={v => updatePlatform(idx, { engagementRate: v ? Number(v) : null })}
                keyboardType="decimal-pad"
              />
              <Field
                label="بوست/أسبوع"
                style={s.statField}
                value={p.data.postsPerWeek != null ? String(p.data.postsPerWeek) : ''}
                onChangeText={v => updatePlatform(idx, { postsPerWeek: v ? Number(v) : null })}
                keyboardType="decimal-pad"
              />
            </View>

            <Text style={s.sectionTitle}>الأسعار (نوع:سعر بكل سطر)</Text>
            <TextInput
              style={[s.input, s.textarea]}
              value={p.pricesText}
              onChangeText={v => setPlatforms(prev => prev.map((x, i) => (i === idx ? { ...x, pricesText: v } : x)))}
              multiline
              placeholder={'صورة:5000\nفيديو:12000'}
              placeholderTextColor={Colors.textMuted}
              textAlign="right"
            />
          </View>
        ))}

        <TouchableOpacity style={[s.saveBtn, saving && s.saveBtnDisabled]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color={Colors.bg} /> : <Text style={s.saveBtnText}>حفظ</Text>}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

function Field({
  label,
  style,
  ...props
}: { label: string; style?: any } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={style}>
      <Text style={s.sectionTitle}>{label}</Text>
      <TextInput
        style={s.input}
        placeholderTextColor={Colors.textMuted}
        textAlign="right"
        {...props}
      />
    </View>
  )
}

function ChipRow<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { v: T; l: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <View style={s.chipRow}>
      {options.map(opt => (
        <TouchableOpacity
          key={String(opt.v)}
          style={[s.chip, value === opt.v && s.chipActive]}
          onPress={() => onChange(opt.v)}
        >
          <Text style={[s.chipText, value === opt.v && s.chipTextActive]}>{opt.l}</Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.gold, fontSize: FontSize.lg, fontWeight: '800' },
  scroll: { padding: Spacing.md, paddingBottom: 60 },
  sectionTitle: { color: Colors.textMuted, fontSize: FontSize.xs, fontWeight: '700', textAlign: 'right', marginTop: Spacing.sm, marginBottom: 6 },
  input: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  textarea: { minHeight: 80, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.s2,
  },
  chipActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  chipText: { color: Colors.text, fontSize: FontSize.sm },
  chipTextActive: { color: Colors.bg, fontWeight: '700' },
  platformsHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },
  addPlatformText: { color: Colors.accent, fontWeight: '700', fontSize: FontSize.sm },
  platformBox: {
    backgroundColor: Colors.s1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: 4,
  },
  platformHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  platformName: { color: Colors.text, fontWeight: '700', fontSize: FontSize.sm },
  removeText: { color: Colors.red, fontSize: FontSize.xs, fontWeight: '600' },
  statsRow: { flexDirection: 'row-reverse', gap: 8 },
  statField: { flex: 1 },
  saveBtn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },
})
