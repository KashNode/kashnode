import { useEffect, type CSSProperties } from 'react'
import { Check, Palette, RotateCcw, Type, X } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import {
  APPEARANCE_THEMES, FONT_PAIRINGS, TEXT_SCALE_PRESETS, useAppearance,
  type AppearanceThemeId, type FontPairingId,
} from '../lib/appearance'

export function SettingsTabs() {
  return <nav className="settings-tabs" aria-label="Settings sections">
    <NavLink to="/settings" end className={({ isActive }) => isActive ? 'active' : ''}>Workspace</NavLink>
    <NavLink to="/settings/appearance" className={({ isActive }) => isActive ? 'active' : ''}>Appearance &amp; Display</NavLink>
  </nav>
}

export function AppearancePage() {
  return <>
    <SettingsTabs />
    <div className="page-intro appearance-page-intro">
      <div><span className="eyebrow">PERSONALIZE WORKSPACE</span><h1>Appearance &amp; Display</h1><p>Set the type, scale, and colors you want across your dashboard.</p></div>
    </div>
    <AppearanceControls />
  </>
}

export function AppearanceControls() {
  const { config, updateConfig, resetConfig } = useAppearance()
  const selectedScale = TEXT_SCALE_PRESETS.find(preset => preset.value === config.textScale)?.label ?? 'Custom'

  return <section className="panel appearance-settings-panel" aria-labelledby="appearance-controls-title">
    <div className="appearance-panel-heading">
      <span className="appearance-heading-icon"><Palette size={19} /></span>
      <span><h2 id="appearance-controls-title">Display preferences</h2><p>Changes apply immediately and save in this browser.</p></span>
    </div>
    <div className="appearance-control-grid">
      <div className="appearance-control">
        <label htmlFor="appearance-font-pair"><strong>Font family</strong><small>Choose a heading and body pairing.</small></label>
        <select id="appearance-font-pair" className="text-field" value={config.fontPairing} onChange={event => updateConfig({ fontPairing: event.target.value as FontPairingId })}>
          {Object.entries(FONT_PAIRINGS).map(([id, pairing]) => <option key={id} value={id}>{pairing.label}</option>)}
        </select>
      </div>
      <fieldset className="appearance-control appearance-scale-control">
        <legend><strong>Global text scale</strong><small>Adjusts dashboard text and spacing together.</small></legend>
        <div className="appearance-scale-options" role="group" aria-label="Global text scale">
          {TEXT_SCALE_PRESETS.map(preset => <button type="button" key={preset.value} className={config.textScale === preset.value ? 'selected' : ''} aria-pressed={config.textScale === preset.value} onClick={() => updateConfig({ textScale: preset.value })}>
            <strong>{preset.label}</strong><span>{Math.round(preset.value * 100)}%</span>
          </button>)}
        </div>
        <div className="appearance-range-readout"><span>Current scale</span><strong>{selectedScale} · {Math.round(config.textScale * 100)}%</strong></div>
      </fieldset>
      <div className="appearance-control appearance-heading-control">
        <label htmlFor="appearance-heading-scale"><strong>Heading prominence</strong><small>Set the heading size and weight.</small></label>
        <div className="appearance-heading-options">
          <div><span>Size multiplier</span><strong>{Math.round(config.headingScale * 100)}%</strong></div>
          <input id="appearance-heading-scale" type="range" min="0.9" max="1.3" step="0.05" value={config.headingScale} onChange={event => updateConfig({ headingScale: Number(event.target.value) })} aria-label="Heading size multiplier" />
          <div className="appearance-range-endpoints"><span>Subtle</span><span>Prominent</span></div>
          <label className="appearance-weight-select" htmlFor="appearance-heading-weight"><span>Heading weight</span>
            <select id="appearance-heading-weight" className="text-field" value={config.headingWeight} onChange={event => updateConfig({ headingWeight: Number(event.target.value) as 600 | 700 | 800 })}>
              <option value={600}>Semibold</option><option value={700}>Bold</option><option value={800}>Extra bold</option>
            </select>
          </label>
        </div>
      </div>
      <fieldset className="appearance-control appearance-theme-control">
        <legend><strong>Color theme</strong><small>Change the dashboard surface and accent colors.</small></legend>
        <div className="appearance-theme-options">
          {(Object.entries(APPEARANCE_THEMES) as [AppearanceThemeId, (typeof APPEARANCE_THEMES)[AppearanceThemeId]][]).map(([id, theme]) => <button type="button" key={id} className={config.theme === id ? 'selected' : ''} aria-pressed={config.theme === id} onClick={() => updateConfig({ theme: id })}>
            <span className="appearance-theme-swatch" style={{ '--theme-primary': theme.primary, '--theme-surface': theme.surface, '--theme-border': theme.border } as CSSProperties}><i /><i /><i /></span>
            <span><strong>{theme.label}</strong><small>{id === 'slate' ? 'Low-light contrast' : 'Light workspace'}</small></span>
            {config.theme === id && <Check size={17} aria-hidden="true" />}
          </button>)}
        </div>
      </fieldset>
    </div>
    <div className="appearance-settings-footer"><span><Type size={15} /> Saved automatically to this device.</span><button type="button" className="secondary-button" onClick={resetConfig}><RotateCcw size={15} /> Reset defaults</button></div>
  </section>
}

export function AppearanceDrawer({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  return <div className="appearance-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <aside className="appearance-drawer" role="dialog" aria-modal="true" aria-labelledby="appearance-drawer-title">
      <header className="appearance-drawer-header">
        <span className="appearance-heading-icon"><Palette size={20} /></span>
        <span><h2 id="appearance-drawer-title">Display &amp; Theme</h2><p>Personalize your workspace</p></span>
        <button type="button" className="icon-button appearance-close" onClick={onClose} aria-label="Close appearance settings"><X size={19} /></button>
      </header>
      <div className="appearance-drawer-body"><AppearanceControls /></div>
    </aside>
  </div>
}
