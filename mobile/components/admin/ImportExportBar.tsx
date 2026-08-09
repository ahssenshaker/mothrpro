import { useState } from 'react'
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native'
import * as FileSystem from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import { useAuth } from '@/context/AuthContext'
import { bulkCreateInfluencers, Influencer } from '@/lib/api'
import { Colors, Spacing, FontSize, Radius } from '@/constants/theme'

interface Props {
  items: Influencer[]
  onImported: () => void
}

// JSON, not Excel: web imports .xlsx via a CDN-loaded parser library.
// Bringing an Excel parser into the app is a much bigger native-dependency
// bet for a feature that's mainly used for bulk backup/restore - JSON export
// matches the API's own request/response shape exactly, so round-tripping
// through it (export here, edit, import back) works without any conversion.
export default function ImportExportBar({ items, onImported }: Props) {
  const { session } = useAuth()
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    if (!items.length) {
      Alert.alert('لا يوجد بيانات', 'لا يوجد مؤثرين لتصديرهم')
      return
    }
    setBusy(true)
    try {
      const path = `${FileSystem.cacheDirectory}moatherpro-influencers-${Date.now()}.json`
      await FileSystem.writeAsStringAsync(path, JSON.stringify(items, null, 2))
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/json' })
      } else {
        Alert.alert('تم الحفظ', path)
      }
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل التصدير')
    } finally {
      setBusy(false)
    }
  }

  async function handleImport() {
    if (!session) return
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' })
    if (result.canceled || !result.assets?.[0]) return
    setBusy(true)
    try {
      const text = await FileSystem.readAsStringAsync(result.assets[0].uri)
      const parsed = JSON.parse(text)
      const records = Array.isArray(parsed) ? parsed : [parsed]
      // New records only - id conflicts should go through the edit screen instead.
      const cleaned = records.map(({ id, ...rest }) => rest)
      await bulkCreateInfluencers(session.access_token, cleaned)
      Alert.alert('تم', `تم استيراد ${cleaned.length} مؤثر`)
      onImported()
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'فشل الاستيراد - تأكد أن الملف بصيغة JSON صحيحة')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={s.row}>
      <TouchableOpacity style={s.btn} onPress={handleExport} disabled={busy}>
        <Text style={s.btnText}>⬇️ تصدير</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btn} onPress={handleImport} disabled={busy}>
        <Text style={s.btnText}>⬆️ استيراد</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.md, paddingTop: Spacing.md },
  btn: {
    flex: 1,
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  btnText: { color: Colors.text, fontSize: FontSize.sm, fontWeight: '600' },
})
