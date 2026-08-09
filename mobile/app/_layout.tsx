import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as Linking from 'expo-linking'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { LanguageProvider } from '@/context/LanguageContext'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/theme'

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

  usePasswordRecoveryLink()

  return null
}

// Handles moatherpro://auth-callback#access_token=...&type=... links tapped
// from outside the app (Mail app - password reset or email confirmation),
// so they arrive as plain deep links rather than through the in-app
// WebBrowser session Google sign-in uses. type=recovery routes to the new
// password screen; any other type (signup confirmation, magic link) just
// needs the session set - NavigationGuard takes it to the directory from there.
function usePasswordRecoveryLink() {
  const router = useRouter()

  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!url) return
      const fragment = url.includes('#') ? url.split('#')[1] : url.split('?')[1]
      if (!fragment) return
      const params = new URLSearchParams(fragment)
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (!access_token || !refresh_token) return
      await supabase.auth.setSession({ access_token, refresh_token })
      if (params.get('type') === 'recovery') {
        router.push('/reset-password')
      }
    }

    Linking.getInitialURL().then(handleUrl)
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url))
    return () => sub.remove()
  }, [router])
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
      <SafeAreaProvider>
        <LanguageProvider>
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
              <Stack.Screen name="reset-password" options={{ presentation: 'modal' }} />
              <Stack.Screen name="admin" options={{ presentation: 'modal' }} />
            </Stack>
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  )
}
