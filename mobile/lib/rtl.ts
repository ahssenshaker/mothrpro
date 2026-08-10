import { Lang } from './i18n'

// The app's screens hardcode 'row-reverse'/'right' in their StyleSheets for
// Arabic reading order. These return the mirrored value for English so it
// can be applied as a small per-element style override (e.g.
// `style={[s.row, { flexDirection: flexRow(lang) }]}`) without having to
// rewrite every StyleSheet into a function of `lang`.
export function flexRow(lang: Lang): 'row' | 'row-reverse' {
  return lang === 'ar' ? 'row-reverse' : 'row'
}

export function textAlign(lang: Lang): 'right' | 'left' {
  return lang === 'ar' ? 'right' : 'left'
}
