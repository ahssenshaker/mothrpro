import { useEffect, useRef } from 'react'
import { View, Text, Image, Animated, Easing, StyleSheet } from 'react-native'
import { Colors, FontSize } from '@/constants/theme'
import { useLanguage } from '@/context/LanguageContext'

// Shown while AuthContext resolves the session/subscriber on cold boot, and
// during signIn()/signInWithGoogle() while the app waits on the network -
// bridges the gap between the native splash screen and the app being ready,
// which previously briefly flashed blank/the login screen.
export default function LoadingScreen() {
  const { t } = useLanguage()
  const spin = useRef(new Animated.Value(0)).current
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )
    spinLoop.start()
    pulseLoop.start()
    return () => {
      spinLoop.stop()
      pulseLoop.stop()
    }
  }, [spin, pulse])

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })

  return (
    <View style={s.screen}>
      <Animated.Image
        source={require('@/assets/logo.png')}
        style={[s.logo, { transform: [{ rotate }, { scale: pulse }] }]}
        resizeMode="contain"
      />
      <Text style={s.text}>{t('appName')}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logo: { width: 84, height: 84 },
  text: { color: Colors.gold, fontSize: FontSize.md, fontWeight: '700', letterSpacing: 0.5 },
})
