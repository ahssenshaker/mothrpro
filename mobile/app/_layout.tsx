import { useCallback, useEffect } from 'react'
import { Alert } from 'react-native'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Colors } from '@/constants/theme'
import * as SplashScreen from 'expo-splash-screen'

SplashScreen.preventAutoHideAsync().catch(() => {})

// Show fatal JS errors in an Alert so we can diagnose crashes
const g = global as any
if (g.ErrorUtils) {
  const prev = g.ErrorUtils.getGlobalHandler()
  g.ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
    if (isFatal) {
      Alert.alert(
        'خطأ — أرسل هذه الرسالة',
        `${error.message}\n\n${error.stack?.slice(0, 400) ?? ''}`,
      )
    }
    prev?.(error, isFatal)
  })
}

function NavigationGuard() {
  const { session, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    const inAuth = segments[0] === '(auth)'
    if (!session && !inAuth) {
      router.replace('/(auth)/login')
    } else if (session && inAuth) {
      router.replace('/(main)')
    }
  }, [session, loading, segments])

  return null
}

export default function RootLayout() {
  const onLayout = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {})
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayout}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <NavigationGuard />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(main)" />
              <Stack.Screen
                name="influencer/[id]"
                options={{
                  presentation: 'modal',
                  animation: 'slide_from_bottom',
                }}
              />
            </Stack>
          </AuthProvider>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
