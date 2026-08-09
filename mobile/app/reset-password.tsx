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
import { supabase } from '@/lib/supabase'
import { useLanguage } from '@/context/LanguageContext'
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const { t, lang } = useLanguage()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState(false)

  async function handleSave() {
    if (password.length < 6) {
      setMsg(t('passwordMinLength'))
      return
    }
    if (password !== confirm) {
      setMsg(t('passwordsMismatch'))
      return
    }
    setLoading(true)
    setMsg('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMsg(t('passwordChanged'))
      setDone(true)
      setTimeout(() => router.replace('/(main)'), 1500)
    } catch (e: any) {
      setMsg(`${t('errorPrefix')} ${e?.message || t('error')}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.card}>
            <Text style={s.icon}>🔐</Text>
            <Text style={s.title}>{t('setNewPassword')}</Text>
            <Text style={s.sub}>{t('enterNewPassword')}</Text>

            <TextInput
              style={[s.input, { textAlign: lang === 'ar' ? 'right' : 'left' }]}
              value={password}
              onChangeText={setPassword}
              placeholder={t('newPasswordPh')}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
            />
            <TextInput
              style={[s.input, { textAlign: lang === 'ar' ? 'right' : 'left' }]}
              value={confirm}
              onChangeText={setConfirm}
              placeholder={t('confirmPasswordPh')}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
            />

            {msg ? (
              <Text style={[s.msg, msg.startsWith('✅') && s.msgOk]}>{msg}</Text>
            ) : null}

            <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleSave} disabled={loading || done}>
              {loading ? (
                <ActivityIndicator color={Colors.bg} />
              ) : (
                <Text style={s.btnText}>{t('savePasswordBtn')}</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flexGrow: 1, justifyContent: 'center', padding: Spacing.lg },
  card: {
    backgroundColor: Colors.s1,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  icon:    { fontSize: 40, marginBottom: 12 },
  title:   { color: Colors.text, fontSize: FontSize.lg, fontWeight: '800', marginBottom: 4 },
  sub:     { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.lg, textAlign: 'center' },
  input: {
    width: '100%',
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'right',
    marginBottom: Spacing.sm,
  },
  msg:      { color: Colors.red, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.sm, fontSize: FontSize.sm },
  msgOk:    { color: Colors.green },
  btn: {
    width: '100%',
    backgroundColor: Colors.gold,
    borderRadius: Radius.md,
    padding: 16,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText:  { color: Colors.bg, fontWeight: '800', fontSize: FontSize.md },
})
