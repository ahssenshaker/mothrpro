import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <View style={s.container}>
          <Text style={s.emoji}>⚠️</Text>
          <Text style={s.title}>حدث خطأ غير متوقع</Text>
          <Text style={s.message}>{this.state.error.message}</Text>
          <TouchableOpacity style={s.btn} onPress={() => this.setState({ error: null })}>
            <Text style={s.btnText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07090f',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emoji:   { fontSize: 48 },
  title:   { color: '#e2e8f0', fontSize: 18, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  message: { color: '#718096', fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  btn:     { backgroundColor: '#f6c74d', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 24 },
  btnText: { color: '#07090f', fontWeight: '800', fontSize: 15 },
})
