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
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState(false)

  async function handleSave() {
    if (password.length < 6) {
      setMsg('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    if (password !== confirm) {
      setMsg('كلمتا المرور غير متطابقتين')
      return
    }
    setLoading(true)
    setMsg('')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setMsg('✅ تم تغيير كلمة المرور بنجاح')
      setDone(true)
      setTimeout(() => router.replace('/(main)'), 1500)
    } catch (e: any) {
      setMsg(`خطأ: ${e?.message || 'حدث خطأ'}`)
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
            <Text style={s.title}>تعيين كلمة مرور جديدة</Text>
            <Text style={s.sub}>أدخل كلمة المرور الجديدة لحسابك</Text>

            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              placeholder="كلمة المرور الجديدة"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              textAlign="right"
            />
            <TextInput
              style={s.input}
              value={confirm}
              onChangeText={setConfirm}
              placeholder="تأكيد كلمة المرور"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              textAlign="right"
            />

            {msg ? (
              <Text style={[s.msg, msg.startsWith('✅') && s.msgOk]}>{msg}</Text>
            ) : null}

            <TouchableOpacity style={[s.btn, loading && s.btnDisabled]} onPress={handleSave} disabled={loading || done}>
              {loading ? (
                <ActivityIndicator color={Colors.bg} />
              ) : (
                <Text style={s.btnText}>حفظ كلمة المرور الجديدة</Text>
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
