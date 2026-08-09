import { useState, ReactNode } from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Spacing, FontSize, Radius, TierColors } from '@/constants/theme'

// Mirrors TOUR_STEPS_AR in index.html (uploaded 2026-08-09) — same 5 steps,
// content re-expressed as RN views instead of raw HTML.

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  box: {
    backgroundColor: Colors.s1,
    borderRadius: 24,
    maxWidth: 440,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: Colors.s2,
    padding: Spacing.lg,
    paddingTop: 30,
    alignItems: 'center',
  },
  closeX: {
    position: 'absolute',
    top: 14,
    left: 14,
    backgroundColor: Colors.s2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeXText: { color: Colors.textMuted, fontSize: FontSize.md },
  stepIcon: { fontSize: 44, marginBottom: 10 },
  stepTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '800', textAlign: 'center' },
  stepSub: { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'center', marginTop: 4 },
  body: { padding: Spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: Spacing.md },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 20, backgroundColor: Colors.accent },
  paragraph: { color: Colors.text, fontSize: FontSize.sm, textAlign: 'right', lineHeight: 22 },
  tagWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  tag: {
    backgroundColor: Colors.s2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tagText: { color: Colors.text, fontSize: FontSize.xs, fontWeight: '700' },
  tierRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  tierTag: {
    backgroundColor: Colors.s2,
    borderWidth: 1,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tierTagText: { fontSize: FontSize.xs, fontWeight: '700' },
  tierDesc: { color: Colors.textMuted, fontSize: FontSize.xs },
  engBox: { backgroundColor: Colors.s2, borderRadius: 12, padding: 14, gap: 8, marginTop: 12 },
  engRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  engLabel: { color: Colors.text, fontSize: FontSize.sm },
  engValue: { fontWeight: '700', fontSize: FontSize.sm },
  noteBox: { backgroundColor: Colors.s2, borderRadius: 8, padding: 10, marginTop: 12 },
  noteText: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'right', lineHeight: 18 },
  sourceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.s2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  sourceText: { color: Colors.text, fontSize: FontSize.xs, flex: 1, textAlign: 'right' },
  lockBox: {
    backgroundColor: Colors.gold + '15',
    borderWidth: 1,
    borderColor: Colors.gold + '33',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
  },
  lockText: { color: Colors.textMuted, fontSize: FontSize.xs, textAlign: 'right' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  skipBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 13,
  },
  skipBtnText: { color: Colors.textMuted, fontWeight: '700', fontSize: FontSize.sm },
  nextBtn: {
    flex: 2,
    backgroundColor: Colors.accent,
    borderRadius: 11,
    paddingVertical: 13,
    alignItems: 'center',
  },
  nextBtnText: { color: Colors.bg, fontWeight: '700', fontSize: FontSize.sm },
})

interface Step {
  icon: string
  title: string
  sub: string
  content: ReactNode
}

function Tag({ label }: { label: string }) {
  return (
    <View style={s.tag}>
      <Text style={s.tagText}>{label}</Text>
    </View>
  )
}

function TierRow({ label, color, desc }: { label: string; color: string; desc: string }) {
  return (
    <View style={s.tierRow}>
      <View style={[s.tierTag, { borderColor: color }]}>
        <Text style={[s.tierTagText, { color }]}>{label}</Text>
      </View>
      <Text style={s.tierDesc}>{desc}</Text>
    </View>
  )
}

function EngRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={s.engRow}>
      <Text style={s.engLabel}>{label}</Text>
      <Text style={[s.engValue, { color }]}>{value}</Text>
    </View>
  )
}

function SourceRow({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={s.sourceRow}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={s.sourceText}>{label}</Text>
    </View>
  )
}

const STEPS: Step[] = [
  {
    icon: '🌟',
    title: 'ما هو مؤثر برو؟',
    sub: 'دليل المؤثرين الموثّق في السوق الخليجي',
    content: (
      <View>
        <Text style={s.paragraph}>
          مؤثر برو هو أول دليل موثّق للمؤثرين في المملكة والخليج، يضم <Text style={{ fontWeight: '800' }}>+500 مؤثر</Text> مع بياناتهم الفعلية:
        </Text>
        <View style={s.tagWrap}>
          <Tag label="📊 أسعار فعلية" />
          <Tag label="📈 نسب تفاعل" />
          <Tag label="👥 بيانات جمهور" />
          <Tag label="🔗 روابط حسابات" />
        </View>
      </View>
    ),
  },
  {
    icon: '📊',
    title: 'التصنيفات (Tiers)',
    sub: 'كيف نصنّف المؤثرين حسب حجم المتابعين؟',
    content: (
      <View style={{ gap: 9 }}>
        <TierRow label="🔥 ألفا" color={TierColors['ألفا']} desc="أكثر من 5 مليون متابع" />
        <TierRow label="⭐ ميجا" color={TierColors['ميجا']} desc="من 1M إلى 5M متابع" />
        <TierRow label="💠 ماكرو" color={TierColors['ماكرو']} desc="من 100K إلى 1M متابع" />
        <TierRow label="🔹 ميكرو" color={TierColors['ميكرو']} desc="من 10K إلى 100K متابع" />
        <TierRow label="🔸 نانو" color={TierColors['نانو']} desc="أقل من 10K متابع" />
      </View>
    ),
  },
  {
    icon: '💡',
    title: 'نسبة التفاعل',
    sub: 'مؤشر قوة المؤثر الحقيقية — أهم من عدد المتابعين',
    content: (
      <View>
        <Text style={s.paragraph}>نسبة التفاعل = (إعجابات + تعليقات) ÷ متابعين × 100</Text>
        <View style={s.engBox}>
          <EngRow label="🟢 ممتاز" value="أكثر من 6%" color={Colors.green} />
          <EngRow label="🟡 جيد" value="3% — 6%" color={Colors.gold} />
          <EngRow label="🔴 منخفض" value="أقل من 3%" color={Colors.red} />
        </View>
        <View style={s.noteBox}>
          <Text style={s.noteText}>💡 مؤثر بـ 50K متابع وتفاعل 8% أفضل توصيةً من مؤثر بـ 500K وتفاعل 1%</Text>
        </View>
      </View>
    ),
  },
  {
    icon: '💰',
    title: 'الأسعار الفعلية',
    sub: 'لا تخمين — بيانات حقيقية من السوق',
    content: (
      <View>
        <Text style={s.paragraph}>الأسعار مجمّعة من:</Text>
        <View style={{ gap: 8, marginTop: 12 }}>
          <SourceRow icon="📋" label="عروض المؤثرين المباشرة" />
          <SourceRow icon="🤝" label="صفقات تعاون منفّذة فعلياً" />
          <SourceRow icon="📊" label="بيانات السوق الخليجية" />
        </View>
        <View style={s.lockBox}>
          <Text style={s.lockText}>🔒 الأسعار والبيانات التفصيلية متاحة لمشتركي برو فقط</Text>
        </View>
      </View>
    ),
  },
  {
    icon: '🔍',
    title: 'كيف تبحث وتصفّي؟',
    sub: 'أدوات البحث تساعدك تلاقي المؤثر المناسب بسرعة',
    content: (
      <View style={{ gap: 10 }}>
        <SourceRow icon="🔍" label="ابحث بالاسم أو التخصص مباشرة" />
        <SourceRow icon="📱" label="صفّ حسب المنصة: انستقرام، سناب، يوتيوب، تيك توك" />
        <SourceRow icon="🏷️" label="فلتر التصنيف، المنطقة، والتخصص" />
        <SourceRow icon="💰" label="فلتر نطاق الأسعار (Pro)" />
      </View>
    ),
  },
]

interface Props {
  visible: boolean
  onClose: () => void
}

export default function TourGuide({ visible, onClose }: Props) {
  const [step, setStep] = useState(0)
  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  function next() {
    if (isLast) {
      onClose()
      setStep(0)
    } else {
      setStep(s => s + 1)
    }
  }

  function handleClose() {
    onClose()
    setStep(0)
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={s.backdrop}>
        <View style={s.box}>
          <View style={s.header}>
            <TouchableOpacity style={s.closeX} onPress={handleClose}>
              <Text style={s.closeXText}>✕</Text>
            </TouchableOpacity>
            <Text style={s.stepIcon}>{current.icon}</Text>
            <Text style={s.stepTitle}>{current.title}</Text>
            <Text style={s.stepSub}>{current.sub}</Text>
          </View>

          <View style={s.body}>
            <View style={s.dots}>
              {STEPS.map((_, i) => (
                <View key={i} style={[s.dot, i === step && s.dotActive]} />
              ))}
            </View>

            {current.content}

            <View style={s.actions}>
              {!isLast ? (
                <TouchableOpacity style={s.skipBtn} onPress={handleClose}>
                  <Text style={s.skipBtnText}>تخطي</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={s.nextBtn} onPress={next}>
                <Text style={s.nextBtnText}>{isLast ? 'ابدأ الاستكشاف 🚀' : 'التالي ←'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  )
}

