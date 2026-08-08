import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useAuth } from '@/context/AuthContext'
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'

export default function RegisterScreen() {
  const { signUp } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleRegister() {
    if (!email.trim() || !password) {
      setError('يرجى ملء جميع الحقول')
      return
    }
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين')
      return
    }
    setLoading(true)
    setError('')
    try {
      await signUp(email.trim().toLowerCase(), password)
      setDone(true)
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.includes('already registered')) {
        setError('هذا البريد الإلكتروني مسجل بالفعل')
      } else {
        setError('حدث خطأ في إنشاء الحساب')
      }
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <SafeAreaView style={s.screen}>
        <View style={s.successBox}>
          <Text style={{ fontSize: 64, textAlign: 'center' }}>✅</Text>
          <Text style={s.successTitle}>تم إنشاء حسابك!</Text>
          <Text style={s.successSub}>
            تحقق من بريدك الإلكتروني لتأكيد الحساب، ثم سجّل الدخول.
          </Text>
          <TouchableOpacity style={s.btn} onPress={() => router.replace('/(auth)/login')}>
            <Text style={s.btnText}>تسجيل الدخول</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.logoBox}>
            <Text style={s.logoStar}>⭐</Text>
            <Text style={s.logoText}>مؤثر برو</Text>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>إنشاء حساب جديد</Text>

            <Text style={s.label}>البريد الإلكتروني</Text>
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              textContentType="emailAddress"
            />

            <Text style={s.label}>كلمة المرور</Text>
            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="6 أحرف على الأقل"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              textAlign="right"
            />

            <Text style={s.label}>تأكيد كلمة المرور</Text>
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="أعد إدخال كلمة المرور"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              textAlign="right"
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={Colors.bg} />
              ) : (
                <Text style={s.btnText}>إنشاء الحساب</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>لديك حساب بالفعل؟ </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={s.footerLink}>تسجيل الدخول</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: Colors.bg },
  scroll:       { flexGrow: 1, padding: Spacing.lg },
  logoBox:      { alignItems: 'center', marginTop: 48, marginBottom: 32 },
  logoStar:     { fontSize: 48, marginBottom: 6 },
  logoText:     { color: Colors.gold, fontSize: FontSize.xxl, fontWeight: '800' },
  card: {
    backgroundColor: Colors.s1,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle:    { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'right', marginBottom: Spacing.md },
  label:        { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'right', marginBottom: 6, marginTop: Spacing.sm },
  input: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'right',
  },
  error:        { color: Colors.red, textAlign: 'center', marginTop: Spacing.sm, fontSize: FontSize.sm },
  btn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  btnDisabled:  { opacity: 0.6 },
  btnText:      { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },
  footer:       { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText:   { color: Colors.textMuted },
  footerLink:   { color: Colors.accent, fontWeight: '600' },
  successBox:   { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  successTitle: { color: Colors.text, fontSize: FontSize.xl, fontWeight: '800', marginTop: 20, textAlign: 'center' },
  successSub:   { color: Colors.textMuted, fontSize: FontSize.md, textAlign: 'center', marginTop: 12, marginBottom: 32, lineHeight: 24 },
})
