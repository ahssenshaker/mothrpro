import { useState } from 'react'
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { AntDesign } from '@expo/vector-icons'
import { useAuth } from '@/context/AuthContext'
import { useLanguage } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase'
import * as Linking from 'expo-linking'
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'

export default function LoginScreen() {
  const { signIn, signInWithGoogle } = useAuth()
  const { t, lang, toggleLang } = useLanguage()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const [resetVisible, setResetVisible] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resetMsg, setResetMsg] = useState('')

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError(t('fillEmailPassword'))
      return
    }
    setLoading(true)
    setError('')
    try {
      await signIn(email.trim().toLowerCase(), password)
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.includes('Invalid login')) {
        setError(t('invalidCredentials'))
      } else if (msg.includes('Email not confirmed')) {
        setError(t('confirmEmailFirst'))
      } else {
        setError(t('loginErrorGeneric'))
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
      setError(e?.message || t('googleLoginFailed'))
    } finally {
      setGoogleLoading(false)
    }
  }

  function openReset() {
    setResetEmail(email)
    setResetMsg('')
    setResetVisible(true)
  }

  async function handleSendReset() {
    if (!resetEmail.trim()) {
      setResetMsg(t('enterEmail'))
      return
    }
    setResetLoading(true)
    setResetMsg('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim().toLowerCase(), {
        redirectTo: Linking.createURL('auth-callback'),
      })
      if (error) throw error
      setResetMsg(t('resetSent'))
      setTimeout(() => setResetVisible(false), 2500)
    } catch {
      setResetMsg(t('resetTryAgain'))
    } finally {
      setResetLoading(false)
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
          {/* Language toggle */}
          <TouchableOpacity style={s.langToggle} onPress={toggleLang}>
            <Text style={s.langToggleText}>{lang === 'ar' ? 'EN' : 'ع'}</Text>
          </TouchableOpacity>

          {/* Logo */}
          <View style={s.logoBox}>
            <Image source={require('@/assets/logo.png')} style={s.logoImage} resizeMode="contain" />
            <Text style={s.logoText}>{t('appName')}</Text>
            <Text style={s.logoSub}>{t('appTagline')}</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>{t('loginBtn')}</Text>

            <Text style={s.label}>{t('email')}</Text>
            <TextInput
              style={[s.input, { textAlign: lang === 'ar' ? 'right' : 'left' }]}
              value={email}
              onChangeText={setEmail}
              placeholder="example@email.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              textContentType="emailAddress"
            />

            <Text style={s.label}>{t('password')}</Text>
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
                <Text style={s.btnText}>{t('loginBtn')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={openReset} style={s.forgotBox}>
              <Text style={s.forgotText}>{t('forgotPassword')}</Text>
            </TouchableOpacity>

            <View style={s.dividerRow}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>{t('or')}</Text>
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
                <>
                  <AntDesign name="google" size={18} color="#EA4335" style={s.googleIcon} />
                  <Text style={s.googleBtnText}>{t('continueWithGoogle')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={s.footer}>
            <Text style={s.footerText}>{t('noAccount')} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={s.footerLink}>{t('signupBtn')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={resetVisible} transparent animationType="fade" onRequestClose={() => setResetVisible(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{t('resetPasswordTitle')}</Text>
            <TextInput
              style={[s.input, { textAlign: lang === 'ar' ? 'right' : 'left' }]}
              value={resetEmail}
              onChangeText={setResetEmail}
              placeholder="example@email.com"
              placeholderTextColor={Colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {resetMsg ? (
              <Text style={[s.resetMsg, resetMsg.startsWith('✅') && s.resetMsgOk]}>{resetMsg}</Text>
            ) : null}
            <TouchableOpacity
              style={[s.btn, resetLoading && s.btnDisabled]}
              onPress={handleSendReset}
              disabled={resetLoading}
            >
              {resetLoading ? (
                <ActivityIndicator color={Colors.bg} />
              ) : (
                <Text style={s.btnText}>{t('sendResetLink')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setResetVisible(false)} style={s.modalCloseBox}>
              <Text style={s.forgotText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: Colors.bg },
  flex:        { flex: 1 },
  scroll:      { flexGrow: 1, padding: Spacing.lg },
  langToggle: {
    alignSelf: 'flex-end',
    backgroundColor: Colors.s2,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginTop: 8,
  },
  langToggleText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '700' },
  logoBox:     { alignItems: 'center', marginTop: 24, marginBottom: 40 },
  logoImage:   { width: 72, height: 72, marginBottom: 8 },
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  googleIcon:  { marginLeft: 8 },
  googleBtnText: { color: Colors.text, fontWeight: '700', fontSize: FontSize.md },
  forgotBox:   { alignItems: 'center', marginTop: Spacing.sm },
  forgotText:  { color: Colors.textMuted, fontSize: FontSize.xs },
  footer:      { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.lg },
  footerText:  { color: Colors.textMuted },
  footerLink:  { color: Colors.accent, fontWeight: '600' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.s1,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle:  { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', textAlign: 'right', marginBottom: Spacing.md },
  modalCloseBox: { alignItems: 'center', marginTop: Spacing.md },
  resetMsg:    { color: Colors.red, textAlign: 'center', marginTop: Spacing.sm, fontSize: FontSize.sm },
  resetMsgOk:  { color: Colors.green },
})
