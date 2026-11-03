import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Download, RotateCcw, Upload } from 'lucide-react'
import { DEFAULT_APPEARANCE, FONT_PAIRINGS, normalizeAppearanceConfig, normalizeStudioConfig, useAppearance, type DashboardStudioConfig } from '../lib/appearance'

const GOOGLE_FONTS = [
  'DM Sans', 'Inter', 'Manrope', 'Merriweather', 'Newsreader', 'Nunito Sans',
  'Open Sans', 'Outfit', 'Plus Jakarta Sans', 'Playfair Display', 'Roboto',
  'Source Sans 3', 'Space Grotesk', 'Work Sans',
]

function fontPrimary(value: string) { return value.split(',')[0].replaceAll('"', '').trim() }

function Slider({ label, value, min, max, step, unit = '', onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (value: number) => void
}) {
  return <label className="studio-slider">
    <span><strong>{label}</strong><output>{Math.round(value * (unit === '%' ? 100 : 1))}{unit}</output></span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={event => onChange(Number(event.target.value))} />
    <small>{min}{unit} – {max}{unit}</small>
  </label>
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="studio-color-control"><span>{label}</span><input aria-label={label} type="color" value={value} onChange={event => onChange(event.target.value)} /></label>
}

export default function DashboardStudio() {
  const { config, updateConfig, studioConfig, updateStudioConfig, resetAll } = useAppearance()
  const [headingDraft, setHeadingDraft] = useState(studioConfig.headingFont || fontPrimary(FONT_PAIRINGS[config.fontPairing].heading))
  const [bodyDraft, setBodyDraft] = useState(studioConfig.bodyFont || fontPrimary(FONT_PAIRINGS[config.fontPairing].body))
  const [status, setStatus] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (headingDraft.trim()) updateStudioConfig({ headingFont: headingDraft.trim() })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [headingDraft])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (bodyDraft.trim()) updateStudioConfig({ bodyFont: bodyDraft.trim() })
    }, 350)
    return () => window.clearTimeout(timer)
  }, [bodyDraft])

  useEffect(() => {
    const pair = FONT_PAIRINGS[config.fontPairing]
    setHeadingDraft(studioConfig.headingFont || fontPrimary(pair.heading))
    setBodyDraft(studioConfig.bodyFont || fontPrimary(pair.body))
  }, [studioConfig.headingFont, studioConfig.bodyFont, config.fontPairing])

  const patch = (values: Partial<DashboardStudioConfig>) => updateStudioConfig(values)
  const exportTheme = () => {
    const payload = { schemaVersion: 1, exportedAt: new Date().toISOString(), appearance: config, studio: studioConfig }
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'kashnode-theme.json'
    link.click()
    URL.revokeObjectURL(url)
    setStatus('Theme downloaded as kashnode-theme.json')
  }
  const importTheme = async (file?: File) => {
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as { studio?: unknown; studioConfig?: unknown; appearance?: unknown }
      const studio = normalizeStudioConfig(parsed.studio ?? parsed.studioConfig)
      updateStudioConfig(studio)
      if (parsed.appearance && typeof parsed.appearance === 'object') updateConfig(normalizeAppearanceConfig(parsed.appearance))
      setStatus('Theme imported and applied.')
    } catch {
      setStatus('That theme file is not valid JSON.')
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return <section className="panel dashboard-studio-panel" aria-labelledby="dashboard-studio-title">
    <div className="appearance-panel-heading">
      <span className="appearance-heading-icon"><span aria-hidden="true">✦</span></span>
      <span><h2 id="dashboard-studio-title">Visual Dashboard Studio</h2><p>Customize the workspace canvas, cards, typography, and layout. Changes preview live and save automatically.</p></span>
    </div>

    <div className="studio-section">
      <h3>Workspace colors</h3>
      <div className="studio-color-grid">
        <ColorControl label="Page background" value={studioConfig.pageBg} onChange={pageBg => patch({ pageBg })} />
        <ColorControl label="Brand accent" value={studioConfig.primaryColor} onChange={primaryColor => patch({ primaryColor })} />
        <ColorControl label="Surface" value={studioConfig.surfaceColor} onChange={surfaceColor => patch({ surfaceColor })} />
        <ColorControl label="Card background" value={studioConfig.cardBgColor} onChange={cardBgColor => patch({ cardBgColor })} />
        <ColorControl label="Heading text" value={studioConfig.headingColor} onChange={headingColor => patch({ headingColor })} />
        <ColorControl label="Body text" value={studioConfig.bodyColor} onChange={bodyColor => patch({ bodyColor })} />
        <ColorControl label="Muted text" value={studioConfig.mutedColor} onChange={mutedColor => patch({ mutedColor })} />
        <ColorControl label="Card border" value={studioConfig.cardBorderColor} onChange={cardBorderColor => patch({ cardBorderColor })} />
      </div>
    </div>

    <div className="studio-section">
      <h3>Card shape &amp; density</h3>
      <div className="studio-slider-grid">
        <Slider label="Card opacity" value={studioConfig.cardOpacity} min={.2} max={1} step={.05} unit="%" onChange={cardOpacity => patch({ cardOpacity })} />
        <Slider label="Border width" value={studioConfig.cardBorderWidth} min={0} max={4} step={1} unit="px" onChange={cardBorderWidth => patch({ cardBorderWidth })} />
        <Slider label="Corner radius" value={studioConfig.cardRadius} min={0} max={30} step={1} unit="px" onChange={cardRadius => patch({ cardRadius })} />
        <Slider label="Internal padding" value={studioConfig.cardPadding} min={10} max={32} step={1} unit="px" onChange={cardPadding => patch({ cardPadding })} />
        <Slider label="Minimum card width" value={studioConfig.cardMinWidth} min={220} max={420} step={10} unit="px" onChange={cardMinWidth => patch({ cardMinWidth })} />
      </div>
      <div className="studio-select-grid">
        <label className="studio-select-control"><span>Border style</span><select className="text-field" value={studioConfig.cardBorderStyle} onChange={event => patch({ cardBorderStyle: event.target.value as DashboardStudioConfig['cardBorderStyle'] })}><option value="solid">Solid</option><option value="dashed">Dashed</option><option value="dotted">Dotted</option><option value="none">None</option></select></label>
        <label className="studio-select-control"><span>Shadow depth</span><select className="text-field" value={studioConfig.cardShadow} onChange={event => patch({ cardShadow: event.target.value as DashboardStudioConfig['cardShadow'] })}><option value="none">None</option><option value="subtle">Subtle</option><option value="elevated">Elevated</option><option value="glow">Accent glow</option></select></label>
        <label className="studio-select-control"><span>Metric card grid</span><select className="text-field" value={studioConfig.gridMode} onChange={event => patch({ gridMode: event.target.value as DashboardStudioConfig['gridMode'] })}><option value="auto-fill">Auto-fill</option><option value="2-column">2 columns</option><option value="3-column">3 columns</option></select></label>
      </div>
    </div>

    <div className="studio-section">
      <h3>Typography studio</h3>
      <p className="studio-helper">Search a font or enter a Google Fonts family name. The font loads live when you pause typing.</p>
      <datalist id="studio-google-fonts">{GOOGLE_FONTS.map(font => <option value={font} key={font} />)}</datalist>
      <div className="studio-font-grid">
        <label className="studio-select-control"><span>Heading font</span><input className="text-field" list="studio-google-fonts" value={headingDraft} onChange={event => setHeadingDraft(event.target.value)} placeholder="Search Google Fonts" /></label>
        <label className="studio-select-control"><span>Body font</span><input className="text-field" list="studio-google-fonts" value={bodyDraft} onChange={event => setBodyDraft(event.target.value)} placeholder="Search Google Fonts" /></label>
      </div>
      <div className="studio-slider-grid studio-type-sliders">
        <Slider label="Overall UI scale" value={studioConfig.uiScale} min={.8} max={1.4} step={.05} unit="%" onChange={uiScale => patch({ uiScale })} />
        <Slider label="Heading size" value={studioConfig.headingScale} min={.8} max={1.6} step={.05} unit="%" onChange={headingScale => patch({ headingScale })} />
        <Slider label="Metric size" value={studioConfig.metricScale} min={.8} max={1.6} step={.05} unit="%" onChange={metricScale => patch({ metricScale })} />
      </div>
    </div>

    <div className="studio-file-actions">
      <button type="button" className="secondary-button" onClick={exportTheme}><Download size={15} /> Download Theme</button>
      <button type="button" className="secondary-button" onClick={() => fileInput.current?.click()}><Upload size={15} /> Upload Theme</button>
      <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={event => void importTheme(event.target.files?.[0])} />
      <button type="button" className="secondary-button" onClick={() => { resetAll(); setStatus('Factory appearance restored.') }}><RotateCcw size={15} /> Reset to Factory</button>
    </div>
    <div className="studio-status" role="status" aria-live="polite">{status || 'Saved automatically to this device.'}</div>
  </section>
}
