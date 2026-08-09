import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
} from 'react'
import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { activateUser } from '@/lib/api'

WebBrowser.maybeCompleteAuthSession()

interface Subscriber {
  id: string
  email: string
  plan: 'free' | 'pro' | 'pending' | 'admin'
  activated_at?: string
  expires_at?: string
}

export type EffectivePlan = 'free' | 'trial' | 'pro' | 'admin'

interface AuthState {
  session: Session | null
  subscriber: Subscriber | null
  effectivePlan: EffectivePlan
  loading: boolean
}

type Action =
  | { type: 'SET_SESSION'; session: Session | null }
  | { type: 'SET_SUBSCRIBER'; subscriber: Subscriber | null }
  | { type: 'LOADED' }

function computePlan(subscriber: Subscriber | null): EffectivePlan {
  if (!subscriber) return 'free'
  if (subscriber.plan === 'admin') return 'admin'
  if (subscriber.plan === 'pro') {
    if (subscriber.expires_at) {
      return new Date(subscriber.expires_at) > new Date() ? 'trial' : 'free'
    }
    return 'pro'
  }
  return 'free'
}

function reducer(state: AuthState, action: Action): AuthState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, session: action.session }
    case 'SET_SUBSCRIBER':
      return {
        ...state,
        subscriber: action.subscriber,
        effectivePlan: computePlan(action.subscriber),
      }
    case 'LOADED':
      return { ...state, loading: false }
  }
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshSubscriber: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    session: null,
    subscriber: null,
    effectivePlan: 'free',
    loading: true,
  })

  const loadSubscriber = useCallback(async (session: Session) => {
    try {
      const { data } = await supabase
        .from('subscribers')
        .select('*')
        .eq('id', session.user.id)
        .single()
      dispatch({ type: 'SET_SUBSCRIBER', subscriber: data ?? null })
    } catch {
      dispatch({ type: 'SET_SUBSCRIBER', subscriber: null })
    }
  }, [])

  const refreshSubscriber = useCallback(async () => {
    if (state.session) await loadSubscriber(state.session)
  }, [state.session, loadSubscriber])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      dispatch({ type: 'SET_SESSION', session })
      if (session) {
        activateUser(session.access_token).catch(() => {})
        await loadSubscriber(session)
      }
      dispatch({ type: 'LOADED' })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      dispatch({ type: 'SET_SESSION', session })
      if (session) {
        activateUser(session.access_token).catch(() => {})
        await loadSubscriber(session)
      } else {
        dispatch({ type: 'SET_SUBSCRIBER', subscriber: null })
      }
      dispatch({ type: 'LOADED' })
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadSubscriber])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  async function signInWithGoogle() {
    // A concrete path (not '/') avoids the ambiguous moatherpro:/// that
    // Linking.createURL('/') produces, so it matches a plain
    // "moatherpro://auth-callback" entry in Supabase's redirect allowlist.
    const redirectTo = Linking.createURL('auth-callback')
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    })
    if (error) throw error

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type !== 'success' || !result.url) {
      throw new Error(`تسجيل الدخول لم يكتمل (${result.type})`)
    }

    const params = new URLSearchParams(
      result.url.includes('#') ? result.url.split('#')[1] : result.url.split('?')[1],
    )
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) {
      throw new Error(params.get('error_description') || `تعذّر تسجيل الدخول عبر جوجل: ${result.url}`.slice(0, 200))
    }
    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token })
    if (sessionError) throw sessionError
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ ...state, signIn, signUp, signInWithGoogle, signOut, refreshSubscriber }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
