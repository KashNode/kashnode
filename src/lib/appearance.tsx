import { createContext, useContext, useLayoutEffect, useState, type ReactNode } from 'react'

export const FONT_PAIRINGS = {
  playfairInter: {
    label: 'Playfair Display + Inter',
    heading: '"Playfair Display", Georgia, serif',
    body: 'Inter, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  },
  outfitJakarta: {
    label: 'Outfit + Plus Jakarta Sans',
    heading: 'Outfit, "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
    body: '"Plus Jakarta Sans", Inter, ui-sans-serif, system-ui, sans-serif',
  },
  merriweatherRoboto: {
    label: 'Merriweather + Roboto',
    heading: 'Merriweather, Georgia, serif',
    body: 'Roboto, Arial, ui-sans-serif, sans-serif',
  },
  system: {
    label: 'System UI',
    heading: 'ui-sans-serif, system-ui, "Segoe UI", sans-serif',
    body: 'ui-sans-serif, system-ui, "Segoe UI", sans-serif',
  },
} as const

export const APPEARANCE_THEMES = {
  forest: {
    label: 'Deep Forest Green',
    primary: '#267b66',
    strong: '#206d5a',
    soft: '#e8f3ef',
    surface: '#ffffff',
    canvas: '#f5f7f4',
    text: '#1e2c29',
    muted: '#788781',
    border: '#e8ede9',
  },
  slate: {
    label: 'Slate Dark',
    primary: '#94a3b8',
    strong: '#cbd5e1',
    soft: '#334155',
    surface: '#1e293b',
    canvas: '#0f172a',
    text: '#f1f5f9',
    muted: '#cbd5e1',
    border: '#334155',
  },
  navy: {
    label: 'Modern Navy',
    primary: '#315b88',
    strong: '#24476e',
    soft: '#e7eff8',
    surface: '#ffffff',
    canvas: '#f2f5fa',
    text: '#1b2c43',
    muted: '#718096',
    border: '#dfe6ef',
  },
} as const

export type FontPairingId = keyof typeof FONT_PAIRINGS
export type AppearanceThemeId = keyof typeof APPEARANCE_THEMES
export type AppearanceConfig = {
  fontPairing: FontPairingId
  textScale: number
  headingScale: number
  headingWeight: 600 | 700 | 800
  theme: AppearanceThemeId
}

const STORAGE_KEY = 'kashnode_appearance_config'

export const DEFAULT_APPEARANCE: AppearanceConfig = {
  fontPairing: 'playfairInter',
  textScale: 1,
  headingScale: 1,
  headingWeight: 700,
  theme: 'forest',
}

export const TEXT_SCALE_PRESETS = [
  { label: 'Compact', value: 0.85 },
  { label: 'Default', value: 1 },
  { label: 'Large', value: 1.15 },
  { label: 'Extra Large', value: 1.3 },
] as const

type AppearanceContextValue = {
  config: AppearanceConfig
  updateConfig: (patch: Partial<AppearanceConfig>) => void
  resetConfig: () => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function readConfig(): AppearanceConfig {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_APPEARANCE
    const saved = JSON.parse(stored) as Partial<AppearanceConfig>
    return {
      fontPairing: saved.fontPairing && saved.fontPairing in FONT_PAIRINGS ? saved.fontPairing : DEFAULT_APPEARANCE.fontPairing,
      textScale: TEXT_SCALE_PRESETS.some(preset => preset.value === saved.textScale) ? saved.textScale! : DEFAULT_APPEARANCE.textScale,
      headingScale: typeof saved.headingScale === 'number' ? Math.min(1.3, Math.max(0.9, saved.headingScale)) : DEFAULT_APPEARANCE.headingScale,
      headingWeight: saved.headingWeight === 600 || saved.headingWeight === 700 || saved.headingWeight === 800 ? saved.headingWeight : DEFAULT_APPEARANCE.headingWeight,
      theme: saved.theme && saved.theme in APPEARANCE_THEMES ? saved.theme : DEFAULT_APPEARANCE.theme,
    }
  } catch {
    return DEFAULT_APPEARANCE
  }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppearanceConfig>(readConfig)

  useLayoutEffect(() => {
    const root = document.documentElement
    const fonts = FONT_PAIRINGS[config.fontPairing]
    const theme = APPEARANCE_THEMES[config.theme]
    root.dataset.appearanceTheme = config.theme
    root.style.setProperty('--app-font-heading', fonts.heading)
    root.style.setProperty('--app-font-body', fonts.body)
    root.style.setProperty('--app-text-scale', String(config.textScale))
    root.style.setProperty('--app-heading-scale', String(config.headingScale))
    root.style.setProperty('--app-heading-weight', String(config.headingWeight))
    root.style.setProperty('--color-primary', theme.primary)
    root.style.setProperty('--color-primary-strong', theme.strong)
    root.style.setProperty('--color-primary-soft', theme.soft)
    root.style.setProperty('--color-surface', theme.surface)
    root.style.setProperty('--color-canvas', theme.canvas)
    root.style.setProperty('--color-text', theme.text)
    root.style.setProperty('--color-muted', theme.muted)
    root.style.setProperty('--color-border', theme.border)
    root.style.setProperty('--green', theme.primary)
    root.style.setProperty('--green-strong', theme.strong)
    root.style.setProperty('--green-soft', theme.soft)
    root.style.setProperty('--surface', theme.surface)
    root.style.setProperty('--canvas', theme.canvas)
    root.style.setProperty('--ink', theme.text)
    root.style.setProperty('--muted', theme.muted)
    root.style.setProperty('--line', theme.border)
    root.style.setProperty('--navy', theme.strong)
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config)) } catch { /* Keep the live preference even if storage is unavailable. */ }
  }, [config])

  const updateConfig = (patch: Partial<AppearanceConfig>) => setConfig(current => ({ ...current, ...patch }))
  const resetConfig = () => setConfig(DEFAULT_APPEARANCE)

  return <AppearanceContext.Provider value={{ config, updateConfig, resetConfig }}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const context = useContext(AppearanceContext)
  if (!context) throw new Error('useAppearance must be used inside AppearanceProvider')
  return context
}
