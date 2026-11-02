type Props = { className?: string; showTagline?: boolean }

/** Brand mark is authored as SVG paths so it stays crisp at any display size. */
export default function KashNodeLogo({ className = '', showTagline = false }: Props) {
  return <span className={`kn-logo-lockup ${className}`}>
    <svg className="kn-logo-mark" viewBox="0 0 128 136" role="img" aria-label="KashNode shield and rising arrow">
      <defs>
        <linearGradient id="kn-shield" x1="17" y1="108" x2="105" y2="22" gradientUnits="userSpaceOnUse"><stop stopColor="#18b8d0"/><stop offset=".48" stopColor="#4de5bd"/><stop offset="1" stopColor="#a4f27c"/></linearGradient>
        <linearGradient id="kn-arrow" x1="23" y1="91" x2="109" y2="20" gradientUnits="userSpaceOnUse"><stop stopColor="#d6fff5"/><stop offset=".5" stopColor="#55e4c0"/><stop offset="1" stopColor="#9af17d"/></linearGradient>
        <filter id="kn-glow"><feGaussianBlur stdDeviation="3.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <path className="kn-shield-glow" d="M63 12 105 32v37c0 26-17 42-42 54C38 111 21 95 21 69V32L63 12Z" fill="none" stroke="url(#kn-shield)" strokeWidth="5" filter="url(#kn-glow)"/>
      <path d="M63 17 100 35v33c0 22-14 36-37 48C40 104 26 90 26 68V35l37-18Z" fill="#08233699" stroke="url(#kn-shield)" strokeWidth="2.5"/>
      <path className="kn-logo-k" d="M39 84V49m1 19 19-20M43 65l18 20" fill="none" stroke="#d7fff6" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
      <path className="kn-logo-n" d="M63 84V49l30 35V48" fill="none" stroke="#d7fff6" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/>
      <path className="kn-logo-arrow" d="M24 81c10-18 19-29 31-32 10-3 18 5 27 2 8-3 16-15 27-29m-19 2 20-3-3 20" fill="none" stroke="url(#kn-arrow)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/>
      <g className="kn-nodes" fill="#0e3141" stroke="url(#kn-shield)" strokeWidth="3">
        <path d="m63 3 8 5v9l-8 5-8-5V8l8-5Z"/><path d="m108 27 8 5v9l-8 5-8-5v-9l8-5Z"/><path d="m107 88 8 5v9l-8 5-8-5v-9l8-5Z"/><path d="m63 111 8 5v9l-8 5-8-5v-9l8-5Z"/><path d="m19 86 8 5v9l-8 5-8-5v-9l8-5Z"/><path d="m19 27 8 5v9l-8 5-8-5v-9l8-5Z"/>
      </g>
    </svg>
    <span className="kn-logo-wording"><strong><span className="kn-word-bold">Kash</span><span className="kn-word-light">Node</span><i>.</i></strong>{showTagline && <small>AI-DRIVEN COMMERCE OPERATIONS</small>}</span>
  </span>
}
