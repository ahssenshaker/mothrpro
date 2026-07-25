import { StyleSheet } from 'react-native'

export const Colors = {
  bg: '#07090f',
  s1: '#0e1422',
  s2: '#131c2e',
  s3: '#192238',
  accent: '#63b3ed',
  gold: '#f6c74d',
  green: '#68d391',
  red: '#fc8181',
  purple: '#b794f4',
  text: '#e2e8f0',
  textMuted: '#718096',
  border: '#1e2d45',
}

export const PlatformColors: Record<string, string> = {
  instagram: '#E1306C',
  tiktok: '#69C9D0',
  youtube: '#FF0000',
  snapchat: '#FFC300',
  twitter: '#1DA1F2',
  x: '#1DA1F2',
  facebook: '#4267B2',
}

export const TierColors: Record<string, string> = {
  'نانو':  '#94a3b8',
  'ميكرو': '#63b3ed',
  'ماكرو': '#68d391',
  'ميجا':  '#f6c74d',
  'ألفا':  '#b794f4',
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
}

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 26,
}

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  full: 9999,
}

export const shared = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  card: {
    backgroundColor: Colors.s1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  input: {
    backgroundColor: Colors.s2,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'right',
  },
  btn: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: {
    backgroundColor: Colors.gold,
  },
  btnText: {
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
})
