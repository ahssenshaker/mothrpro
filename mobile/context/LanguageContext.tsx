import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Lang, TKey, translate, translateField, translateList } from '@/lib/i18n'

const LANG_KEY = 'lang' // same storage key name as web's localStorage, for consistency

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (key: TKey) => string
  tf: (obj: Record<string, any>, field: string) => string
  tfList: (obj: Record<string, any>, field: string) => string[]
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar')

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then(saved => {
      if (saved === 'ar' || saved === 'en') setLangState(saved)
    })
  }, [])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    AsyncStorage.setItem(LANG_KEY, l)
  }, [])

  const toggleLang = useCallback(() => {
    setLang(lang === 'ar' ? 'en' : 'ar')
  }, [lang, setLang])

  const t = useCallback((key: TKey) => translate(key, lang), [lang])
  const tf = useCallback((obj: Record<string, any>, field: string) => translateField(obj, field, lang), [lang])
  const tfList = useCallback((obj: Record<string, any>, field: string) => translateList(obj, field, lang), [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, tf, tfList }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider')
  return ctx
}

// Text alignment/direction helper - the app's layout stays LTR-structured
// throughout (I18nManager.forceRTL is never called, same as the existing
// screens which set textAlign="right" manually rather than mirroring
// layout), so this only flips text alignment, not flex direction.
export function textAlignFor(lang: Lang): 'right' | 'left' {
  return lang === 'ar' ? 'right' : 'left'
}
