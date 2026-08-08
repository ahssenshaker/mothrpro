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

export default function LoginScreen() {
  const { signIn, signInWithGoogle } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('يرجى إدخال البريد وكلمة المرور')
      return
    }
    setLoading(true)
    setError('')
    try {
      await signIn(email.trim().toLowerCase(), password)
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.includes('Invalid login')) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
      } else if (msg.includes('Email not confirmed')) {
        setError('يرجى تأكيد بريدك الإلكتروني أولاً')
      } else {
        setError('حدث خطأ في تسجيل الدخول')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setError('')
    try {
      await signInWithGoogle()
    } catch (e: any) {
      setError(e?.message || 'تعذّر تسجيل الدخول عبر جوجل')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.flex}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={s.logoBox}>
            <Text style={s.logoStar}>⭐</Text>
            <Text style={s.logoText}>مؤثر برو</Text>
            <Text style={s.logoSub}>دليل المؤثرين المحترف</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>تسجيل الدخول</Text>

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
              placeholder="••••••••"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              textContentType="password"
              textAlign="right"
            />

            {error ? <Text style={s.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[s.btn, loading && s.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={Colors.bg} />
              ) : (
                <Text style={s.btnText}>تسجيل الدخول</Text>
              )}
            </TouchableOpacity>

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>أو</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity
              style={[s.googleBtn, googleLoading && s.btnDisabled]}
              onPress={handleGoogleLogin}
              disabled={googleLoading}
              activeOpacity={0.8}
            >
              {googleLoading ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <Text style={s.googleBtnText}>المتابعة عبر جوجل</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>ليس لديك حساب؟ </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={s.footerLink}>إنشاء حساب</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: Colors.bg },
  flex:        { flex: 1 },
  scroll:      { flexGrow: 1, padding: Spacing.lg },
  logoBox:     { alignItems: 'center', marginTop: 60, marginBottom: 40 },
  logoStar:    { fontSize: 52, marginBottom: 8 },
  logoText:    { color: Colors.gold, fontSize: FontSize.xxl, fontWeight: '800' },
  logoSub:     { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 4 },
  card: {
    backgroundColor: Colors.s1,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle:   { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'right', marginBottom: Spacing.md },
  label:       { color: Colors.textMuted, fontSize: FontSize.sm, textAlign: 'right', marginBottom: 6, marginTop: Spacing.sm },
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
  error:       { color: Colors.red, textAlign: 'center', marginTop: Spacing.sm, fontSize: FontSize.sm },
  btn: {
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:     { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },
  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, fontSize: FontSize.sm },
  googleBtn: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  googleBtnText: { color: Colors.text, fontWeight: '700', fontSize: FontSize.md },
  footer:      { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText:  { color: Colors.textMuted },
  footerLink:  { color: Colors.accent, fontWeight: '600' },
})
