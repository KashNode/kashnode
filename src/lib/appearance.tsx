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

export type DashboardStudioConfig = {
  pageBg: string
  primaryColor: string
  surfaceColor: string
  headingColor: string
  bodyColor: string
  mutedColor: string
  cardBgColor: string
  cardOpacity: number
  cardBorderColor: string
  cardBorderStyle: 'solid' | 'dashed' | 'dotted' | 'none'
  cardBorderWidth: number
  cardRadius: number
  cardShadow: 'none' | 'subtle' | 'elevated' | 'glow'
  cardPadding: number
  cardMinWidth: number
  gridMode: 'auto-fill' | '2-column' | '3-column'
  uiScale: number
  headingScale: number
  metricScale: number
  headingFont: string
  bodyFont: string
}

export const DEFAULT_STUDIO_CONFIG: DashboardStudioConfig = {
  pageBg: '#f5f7f4',
  primaryColor: '#267b66',
  surfaceColor: '#ffffff',
  headingColor: '#24342e',
  bodyColor: '#46564f',
  mutedColor: '#788781',
  cardBgColor: '#ffffff',
  cardOpacity: 1,
  cardBorderColor: '#e8ede9',
  cardBorderStyle: 'solid',
  cardBorderWidth: 1,
  cardRadius: 13,
  cardShadow: 'subtle',
  cardPadding: 18,
  cardMinWidth: 260,
  gridMode: 'auto-fill',
  uiScale: 1,
  headingScale: 1,
  metricScale: 1,
  headingFont: '',
  bodyFont: '',
}

const STUDIO_STORAGE_KEY = 'kashnode_dashboard_studio_config'
const COLOR_KEYS = ['pageBg', 'primaryColor', 'surfaceColor', 'headingColor', 'bodyColor', 'mutedColor', 'cardBgColor', 'cardBorderColor'] as const
const clampNumber = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
const validColor = (value: unknown, fallback: string) =>
  typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : fallback

export function normalizeStudioConfig(value: unknown): DashboardStudioConfig {
  const saved = value && typeof value === 'object' ? value as Partial<DashboardStudioConfig> : {}
  const normalized = { ...DEFAULT_STUDIO_CONFIG }
  for (const key of COLOR_KEYS) normalized[key] = validColor(saved[key], DEFAULT_STUDIO_CONFIG[key])
  return {
    ...normalized,
    cardOpacity: clampNumber(saved.cardOpacity, normalized.cardOpacity, .2, 1),
    cardBorderStyle: ['solid', 'dashed', 'dotted', 'none'].includes(saved.cardBorderStyle || '') ? saved.cardBorderStyle! : normalized.cardBorderStyle,
    cardBorderWidth: clampNumber(saved.cardBorderWidth, normalized.cardBorderWidth, 0, 4),
    cardRadius: clampNumber(saved.cardRadius, normalized.cardRadius, 0, 30),
    cardShadow: ['none', 'subtle', 'elevated', 'glow'].includes(saved.cardShadow || '') ? saved.cardShadow! : normalized.cardShadow,
    cardPadding: clampNumber(saved.cardPadding, normalized.cardPadding, 10, 32),
    cardMinWidth: clampNumber(saved.cardMinWidth, normalized.cardMinWidth, 220, 420),
    gridMode: ['auto-fill', '2-column', '3-column'].includes(saved.gridMode || '') ? saved.gridMode! : normalized.gridMode,
    uiScale: clampNumber(saved.uiScale, normalized.uiScale, .8, 1.4),
    headingScale: clampNumber(saved.headingScale, normalized.headingScale, .8, 1.6),
    metricScale: clampNumber(saved.metricScale, normalized.metricScale, .8, 1.6),
    headingFont: typeof saved.headingFont === 'string' ? saved.headingFont.trim().slice(0, 60) : normalized.headingFont,
    bodyFont: typeof saved.bodyFont === 'string' ? saved.bodyFont.trim().slice(0, 60) : normalized.bodyFont,
  }
}

function readStudioConfig(): DashboardStudioConfig {
  try {
    const saved = window.localStorage.getItem(STUDIO_STORAGE_KEY)
    return saved ? normalizeStudioConfig(JSON.parse(saved)) : DEFAULT_STUDIO_CONFIG
  } catch { return DEFAULT_STUDIO_CONFIG }
}

export function normalizeAppearanceConfig(value: unknown): AppearanceConfig {
  const saved = value && typeof value === 'object' ? value as Partial<AppearanceConfig> : {}
  return {
    fontPairing: saved.fontPairing && saved.fontPairing in FONT_PAIRINGS ? saved.fontPairing : DEFAULT_APPEARANCE.fontPairing,
    textScale: TEXT_SCALE_PRESETS.some(preset => preset.value === saved.textScale) ? saved.textScale! : DEFAULT_APPEARANCE.textScale,
    headingScale: typeof saved.headingScale === 'number' ? Math.min(1.3, Math.max(.9, saved.headingScale)) : DEFAULT_APPEARANCE.headingScale,
    headingWeight: saved.headingWeight === 600 || saved.headingWeight === 700 || saved.headingWeight === 800 ? saved.headingWeight : DEFAULT_APPEARANCE.headingWeight,
    theme: saved.theme && saved.theme in APPEARANCE_THEMES ? saved.theme : DEFAULT_APPEARANCE.theme,
  }
}

type AppearanceContextValue = {
  config: AppearanceConfig
  updateConfig: (patch: Partial<AppearanceConfig>) => void
  resetConfig: () => void
  studioConfig: DashboardStudioConfig
  updateStudioConfig: (patch: Partial<DashboardStudioConfig>) => void
  resetStudioConfig: () => void
  resetAll: () => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function readConfig(): AppearanceConfig {
  try { return normalizeAppearanceConfig(JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}')) }
  catch { return DEFAULT_APPEARANCE }
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppearanceConfig>(readConfig)
  const [studioConfig, setStudioConfig] = useState<DashboardStudioConfig>(readStudioConfig)

  useLayoutEffect(() => {
    const root = document.documentElement
    const fonts = FONT_PAIRINGS[config.fontPairing]
    const theme = APPEARANCE_THEMES[config.theme]
    const headingFont = studioConfig.headingFont || fonts.heading.split(',')[0].replaceAll('"', '').trim()
    const bodyFont = studioConfig.bodyFont || fonts.body.split(',')[0].replaceAll('"', '').trim()
    const importFont = (family: string, id: string) => {
      if (!/^[\p{L}\p{N} -]+$/u.test(family)) return
      let link = document.getElementById(id) as HTMLLinkElement | null
      if (!link) {
        link = document.createElement('link')
        link.id = id
        link.rel = 'stylesheet'
        document.head.appendChild(link)
      }
      link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll('%20', '+')}:wght@400;500;600;700;800&display=swap`
    }
    importFont(headingFont, 'kashnode-studio-heading-font')
    importFont(bodyFont, 'kashnode-studio-body-font')
    root.dataset.dashboardStudio = 'true'
    root.dataset.studioGrid = studioConfig.gridMode
    root.style.setProperty('--app-font-heading', `"${headingFont}", Georgia, serif`)
    root.style.setProperty('--app-font-body', `"${bodyFont}", Inter, ui-sans-serif, system-ui, sans-serif`)
    root.style.setProperty('--studio-ui-scale', String(studioConfig.uiScale))
    root.style.setProperty('--studio-heading-scale', String(studioConfig.headingScale))
    root.style.setProperty('--studio-metric-scale', String(studioConfig.metricScale))
    root.style.setProperty('--bg-page', studioConfig.pageBg)
    root.style.setProperty('--text-heading', studioConfig.headingColor)
    root.style.setProperty('--text-body', studioConfig.bodyColor)
    root.style.setProperty('--text-muted', studioConfig.mutedColor)
    root.style.setProperty('--card-bg', studioConfig.cardBgColor)
    root.style.setProperty('--card-opacity', String(studioConfig.cardOpacity))
    root.style.setProperty('--card-border', studioConfig.cardBorderColor)
    root.style.setProperty('--card-border-style', studioConfig.cardBorderStyle)
    root.style.setProperty('--card-border-width', `${studioConfig.cardBorderWidth}px`)
    root.style.setProperty('--card-radius', `${studioConfig.cardRadius}px`)
    root.style.setProperty('--card-shadow', studioConfig.cardShadow === 'none' ? 'none' : studioConfig.cardShadow === 'subtle' ? '0 2px 8px rgba(25,45,35,.06)' : studioConfig.cardShadow === 'elevated' ? '0 12px 30px rgba(25,45,35,.14)' : `0 0 24px color-mix(in srgb, ${studioConfig.primaryColor} 28%, transparent)`)
    root.style.setProperty('--card-padding', `${studioConfig.cardPadding}px`)
    root.style.setProperty('--card-min-width', `${studioConfig.cardMinWidth}px`)
    root.style.setProperty('--color-primary', studioConfig.primaryColor)
    root.style.setProperty('--color-primary-strong', studioConfig.primaryColor)
    root.style.setProperty('--color-primary-soft', `color-mix(in srgb, ${studioConfig.primaryColor} 13%, white)`)
    root.style.setProperty('--color-surface', studioConfig.surfaceColor)
    root.style.setProperty('--color-canvas', studioConfig.pageBg)
    root.style.setProperty('--color-text', studioConfig.headingColor)
    root.style.setProperty('--color-muted', studioConfig.mutedColor)
    root.style.setProperty('--color-border', studioConfig.cardBorderColor)
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
    root.style.setProperty('--app-font-heading', `"${headingFont}", Georgia, serif`)
    root.style.setProperty('--app-font-body', `"${bodyFont}", Inter, ui-sans-serif, system-ui, sans-serif`)
    root.style.setProperty('--studio-ui-scale', String(studioConfig.uiScale))
    root.style.setProperty('--studio-heading-scale', String(studioConfig.headingScale))
    root.style.setProperty('--studio-metric-scale', String(studioConfig.metricScale))
    root.style.setProperty('--bg-page', studioConfig.pageBg)
    root.style.setProperty('--text-heading', studioConfig.headingColor)
    root.style.setProperty('--text-body', studioConfig.bodyColor)
    root.style.setProperty('--text-muted', studioConfig.mutedColor)
    root.style.setProperty('--card-bg', studioConfig.cardBgColor)
    root.style.setProperty('--card-opacity', String(studioConfig.cardOpacity))
    root.style.setProperty('--card-border', studioConfig.cardBorderColor)
    root.style.setProperty('--card-border-style', studioConfig.cardBorderStyle)
    root.style.setProperty('--card-border-width', `${studioConfig.cardBorderWidth}px`)
    root.style.setProperty('--card-radius', `${studioConfig.cardRadius}px`)
    root.style.setProperty('--card-padding', `${studioConfig.cardPadding}px`)
    root.style.setProperty('--card-min-width', `${studioConfig.cardMinWidth}px`)
    root.style.setProperty('--card-shadow', studioConfig.cardShadow === 'none' ? 'none' : studioConfig.cardShadow === 'subtle' ? '0 2px 8px rgba(25,45,35,.06)' : studioConfig.cardShadow === 'elevated' ? '0 12px 30px rgba(25,45,35,.14)' : `0 0 24px color-mix(in srgb, ${studioConfig.primaryColor} 28%, transparent)`)
    root.style.setProperty('--color-primary', studioConfig.primaryColor)
    root.style.setProperty('--color-primary-strong', studioConfig.primaryColor)
    root.style.setProperty('--color-primary-soft', `color-mix(in srgb, ${studioConfig.primaryColor} 13%, white)`)
    root.style.setProperty('--color-surface', studioConfig.surfaceColor)
    root.style.setProperty('--color-canvas', studioConfig.pageBg)
    root.style.setProperty('--color-text', studioConfig.headingColor)
    root.style.setProperty('--color-muted', studioConfig.mutedColor)
    root.style.setProperty('--color-border', studioConfig.cardBorderColor)
    root.style.setProperty('--green', studioConfig.primaryColor)
    root.style.setProperty('--green-strong', studioConfig.primaryColor)
    root.style.setProperty('--green-soft', `color-mix(in srgb, ${studioConfig.primaryColor} 13%, white)`)
    root.style.setProperty('--surface', studioConfig.surfaceColor)
    root.style.setProperty('--canvas', studioConfig.pageBg)
    root.style.setProperty('--ink', studioConfig.headingColor)
    root.style.setProperty('--muted', studioConfig.mutedColor)
    root.style.setProperty('--line', studioConfig.cardBorderColor)
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config)) } catch { /* Keep the live preference even if storage is unavailable. */ }
    try { window.localStorage.setItem(STUDIO_STORAGE_KEY, JSON.stringify(studioConfig)) } catch { /* Keep the live preference if storage is unavailable. */ }
  }, [config, studioConfig])

  const updateConfig = (patch: Partial<AppearanceConfig>) => setConfig(current => ({ ...current, ...patch }))
  const resetConfig = () => setConfig(DEFAULT_APPEARANCE)
  const updateStudioConfig = (patch: Partial<DashboardStudioConfig>) => setStudioConfig(current => normalizeStudioConfig({ ...current, ...patch }))
  const resetStudioConfig = () => setStudioConfig(DEFAULT_STUDIO_CONFIG)
  const resetAll = () => { setConfig(DEFAULT_APPEARANCE); setStudioConfig(DEFAULT_STUDIO_CONFIG) }

  return <AppearanceContext.Provider value={{ config, updateConfig, resetConfig, studioConfig, updateStudioConfig, resetStudioConfig, resetAll }}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  const context = useContext(AppearanceContext)
  if (!context) throw new Error('useAppearance must be used inside AppearanceProvider')
  return context
}
