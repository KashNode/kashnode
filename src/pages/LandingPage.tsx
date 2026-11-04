import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Check,
  Mic,
  PackageCheck,
  PhoneCall,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import {
  LOGO_BKASH,
  LOGO_KASHNODE,
  LOGO_NAGAD,
  LOGO_PATHAO,
  LOGO_ROCKET,
  LOGO_SHOPIFY,
  LOGO_STEADFAST,
  LOGO_UPAY,
  LOGO_WOOCOMMERCE,
} from './landingLogos'

// Copy, section order and headings follow the uploaded KashNode front-page
// HTML export exactly: announcement, hero + dashboard preview, logo band,
// platform, how it works, verification, MFS, Kash AI, owner app, KashNode Box,
// pricing, FAQ, final CTA and footer. Brand marks are the original logos
// extracted from that export, not redrawn marks.

const terminalSteps = {
  verify: [
    'Order #KN-2481 received — phone +880 1XXX-XXX-420',
    'SMS sent from the owner SIM inside KashNode Box',
    'Customer verified the code — real customer confirmed',
    'Fake / fraud COD risk reduced. Order marked verified.',
  ],
  call: [
    'Customer calls the business SIM',
    'Call forwards: KashNode Box -> Central Server -> Kash AI',
    'Kash: “Order confirmed. Your parcel is being prepared.”',
    'No human touch. Call logged to the owner dashboard.',
  ],
  courier: [
    'Verified order sent to courier automatically',
    'Steadfast / Pathao booking created',
    'Rider Secret PIN generated for safe handover',
    'Customer notified by phone call at confirmation.',
  ],
} as const

type TerminalAction = keyof typeof terminalSteps

const platform = [
  {
    tag: 'CORE',
    title: 'KashNode Central server',
    body: 'The heart of the system. Node.js + Asterisk orchestrate orders, calls, SMS and courier APIs from one place — every event, one timeline.',
    chips: ['Node.js', 'Asterisk', 'WebSocket', 'Webhooks'],
    link: '#how',
    linkText: 'Explore',
  },
  {
    tag: 'CORE',
    title: 'Kash AI Worker agent',
    body: 'Kash listens, understands and speaks. Speech-to-text, LLM reasoning and text-to-speech let Kash confirm orders and payments on live calls, in Bangla.',
    chips: ['STT', 'LLM', 'TTS', 'Bangla voice'],
    link: '#kash',
    linkText: 'Meet Kash',
  },
  {
    tag: 'CORE',
    title: 'KashNode Box device',
    body: 'Our custom-built box sits at your home or office with your business SIM inside and a USB 4G voice modem. It sends verification SMS, reads bKash SMS and routes calls to the KashNode server.',
    chips: ['Custom device', 'Your SIM inside', 'USB 4G Modem'],
    link: '#edge',
    linkText: 'See the device',
  },
  {
    tag: 'CORE',
    title: 'KashNode Database',
    body: 'Multi-tenant data on Supabase. Every store isolated, every TrxID matched against its order, every minute of balance accounted for.',
    chips: ['Multi-tenant', 'TrxID matching', 'PostgreSQL'],
    link: '#verify',
    linkText: 'How matching works',
  },
  {
    tag: 'CORE',
    title: 'KashNode Courier logistics',
    body: 'The moment payment verifies, the parcel is booked with Steadfast or Pathao and a Rider Secret PIN is generated. Zero copy-paste.',
    chips: ['Steadfast', 'Pathao', 'Rider PIN'],
    link: '#how',
    linkText: 'See the flow',
  },
  {
    tag: 'CORE',
    title: 'KashNode Packages billing',
    body: 'Monthly packages sized by the orders you process, with AI minutes included. Talk time is counted in minutes inside the package — extra minutes are a flat ৳7/min overage, rechargeable in the app.',
    chips: ['From ৳2,000 / mo', 'Minutes included', 'Overage ৳7/min'],
    link: '#pricing',
    linkText: 'See pricing',
  },
]

const steps = [
  {
    n: '1',
    title: 'Order arrives via plugin',
    body: 'The KashNode plugin on your WooCommerce, Shopify or custom store takes the order — the customer fills in their phone number and taps Order Now, choosing bKash or Cash on Delivery.',
    chip: 'Plugin · WooCommerce / Shopify / Custom',
  },
  {
    n: '2',
    title: 'SMS verification from your SIM',
    body: 'The KashNode Box at your premises sends a verification SMS from your own business SIM. The customer enters the code — proof this is a real customer, so fake and fraud orders drop sharply.',
    chip: 'Your SIM · Verification code',
  },
  {
    n: '3',
    title: 'Payment is verified',
    body: 'Paying by bKash? The customer’s payment is verified with its verification code / TrxID against the exact order and amount. Prefer COD? That works too — no prepayment needed.',
    chip: 'bKash code check · COD supported',
  },
  {
    n: '4',
    title: 'AI confirms & parcel ships',
    body: 'At order confirmation — or when the courier fulfilment request goes out — Kash calls the customer to say the order is confirmed, and the Steadfast / Pathao booking is created with a Rider Secret PIN.',
    chip: 'AI confirmation call · Auto booking',
  },
]

const tiers = [
  {
    name: 'Free Trial',
    price: '৳0',
    period: '/ test credit',
    orders: '10 orders · 10 minutes included',
    desc: 'Try the full flow before you pay anything — built for testing, not for running a store.',
    features: ['COD SMS verification, end to end', 'Test an MFS payment verification', 'Hear a real Kash AI call', 'Owner dashboard preview included'],
    cta: 'Start Free Trial',
    popular: false,
  },
  {
    name: 'Basic',
    price: '৳2,000',
    period: '/ month',
    orders: '300 orders · 300 minutes included',
    desc: 'The starting package for a growing store — every core automation included.',
    features: ['SMS verification from your own SIM', 'bKash, Nagad, Rocket & Upay verification', 'Kash AI confirmation calls', 'Automatic courier booking + Rider PIN', 'Owner app, voice switch & recharge'],
    cta: 'Choose Basic',
    popular: false,
  },
  {
    name: 'Standard',
    price: '৳5,500',
    period: '/ month',
    orders: '1,000 orders · 1,000 minutes included',
    desc: 'For stores selling every day — more volume at a lower effective minute rate.',
    features: ['Everything in Basic', '1,000 orders with 1,000 minutes included', 'Lower effective rate — ≈ ৳5.50/min', 'Overage stays simple: ৳7/min', 'Low-balance warning before you run dry'],
    cta: 'Choose Standard',
    popular: true,
  },
  {
    name: 'Premium',
    price: '৳14,000',
    period: '/ month',
    orders: '3,000 orders · 3,000 minutes included',
    desc: 'For high-volume stores that never want a call, a verification or a parcel to wait.',
    features: ['Everything in Standard', '3,000 orders with 3,000 minutes included', 'Lowest effective rate — ≈ ৳4.67/min', 'Priority support', 'Overage stays simple: ৳7/min'],
    cta: 'Choose Premium',
    popular: false,
  },
]

const faqs = [
  {
    q: 'How does KashNode stop fake COD orders?',
    a: 'As soon as a customer enters their phone number on your store and taps Order Now, a verification SMS goes out from the business SIM inside the KashNode Box at your home or office. When the customer enters the code, you know they are real — so the chance of fake and fraud orders drops sharply.',
  },
  {
    q: 'My store isn’t WooCommerce — does Shopify or a custom store work too?',
    a: 'Yes. KashNode’s plugin and store connection are built for WooCommerce, Shopify and custom stores alike — the moment an order arrives, the same verification flow starts.',
  },
  {
    q: 'When a customer calls, how does the call reach the AI?',
    a: 'The customer never calls the AI directly — they call your business SIM number, as always. The KashNode Box forwards that call to the KashNode server, the server passes it to the AI, and the customer talks with the AI. No human touch is needed.',
  },
  {
    q: 'How is a bKash payment verified? Can I take COD too?',
    a: 'Both. When a customer sends money by bKash, they provide the verification code, and KashNode matches the code / TrxID against the order to verify it. With Cash on Delivery, the customer is verified through the same SMS verification.',
  },
  {
    q: 'How is the cost calculated?',
    a: 'As a monthly package — not per-minute alone, and not per-order alone. Our costs (AI/API + server) run by the minute, but sellers plan by the month’s orders — so the Basic package includes 300 minutes for 300 orders at ৳2,000/month. If you need extra minutes beyond your package, the overage is ৳7/min, and you can recharge right from the owner app.',
  },
  {
    q: 'Can I see whether the AI is really working? Can I change its voice?',
    a: 'Yes. In the owner app and dashboard you can watch live whether the AI is working, and which calls and verifications it has handled. You can also change the AI’s voice whenever you like — from female to male, or male to female.',
  },
  {
    q: 'Is courier booking really automatic?',
    a: 'Yes — as soon as an order is confirmed, the booking is created with Steadfast or Pathao, complete with a Rider Secret PIN, and on the confirmation call Kash tells the customer that their order is confirmed.',
  },
  {
    q: 'Do I need a separate SIM or device?',
    a: 'No separate purchase needed — the KashNode Box is our custom-built device, with your business SIM inside it. The Box stays at your home or office, and the SIM never goes anywhere.',
  },
]

type Theme = 'dark' | 'system' | 'custom'

export default function LandingPage() {
  const [action, setAction] = useState<TerminalAction>('verify')
  const [logs, setLogs] = useState<string[]>([...terminalSteps.verify])
  const [theme, setTheme] = useState<Theme>('dark')
  const [systemDark, setSystemDark] = useState(true)
  const [voice, setVoice] = useState<'Female' | 'Male'>('Female')
  const [minutes, setMinutes] = useState(184)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Theme is not saved: a reload returns to Dark, as on the front page.
  const isLight = theme === 'custom' || (theme === 'system' && !systemDark)
  const page = isLight ? 'bg-[#f5f8fa] text-slate-900' : 'bg-[#04070d] text-slate-100'
  const header = isLight ? 'border-slate-200 bg-white/85' : 'border-white/10 bg-[#04070d]/80'
  const muted = isLight ? 'text-slate-600' : 'text-slate-300'
  const faint = isLight ? 'text-slate-500' : 'text-slate-400'
  const card = isLight ? 'border-slate-200 bg-white hover:border-teal-600/50' : 'border-white/10 bg-white/[0.04] hover:border-emerald-400/40'
  const chip = isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-200'
  const logoChip = 'flex items-center justify-center rounded-2xl bg-white px-4 py-3'

  function runTerminal(next: TerminalAction) {
    setAction(next)
    setLogs([...terminalSteps[next]])
  }

  return (
    <div className={`min-h-screen antialiased ${page}`}>
      <div className="bg-emerald-400 px-5 py-2 text-center text-xs font-bold text-slate-950">
        New — KashNode now verifies COD orders by SMS from your own business SIM — before the parcel leaves.{' '}
        <a href="#verify" className="underline">See how verification works →</a>
      </div>

      <header className={`sticky top-0 z-40 border-b backdrop-blur ${header}`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <img src={LOGO_KASHNODE} alt="KashNode logo" className="h-9 w-9 rounded-lg object-cover" />
            KashNode
          </Link>
          <nav className={`hidden items-center gap-4 text-sm lg:flex ${muted}`}>
            <a href="#platform">Platform</a>
            <a href="#how">Automation</a>
            <a href="#verify">Verification</a>
            <a href="#mfs">Payments</a>
            <a href="#kash">Kash AI</a>
            <a href="#edge">KashNode Box</a>
            <a href="#app">Owner App</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQ</a>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <div className={`flex rounded-full p-1 text-xs font-bold ${isLight ? 'bg-slate-100' : 'bg-white/10'}`} title="Theme is not saved — a reload returns to Dark">
              {(['dark', 'system', 'custom'] as Theme[]).map((t) => (
                <button key={t} onClick={() => setTheme(t)} aria-pressed={theme === t} className={`rounded-full px-3 py-1 capitalize ${theme === t ? 'bg-emerald-400 text-slate-950' : ''}`}>{t}</button>
              ))}
            </div>
            <Link to="/login" className={`hidden text-sm sm:inline ${muted}`}>Sign in</Link>
            <Link to="/login" className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">Get Started</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 text-center md:pt-20">
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-widest text-emerald-300">
              <Sparkles size={14} /> KashNode · Kash AI — the agent that runs your store’s routine
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
              Payments verified. Calls answered. Parcels shipped. Automatically.
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className={`mx-auto mt-5 max-w-2xl text-base leading-relaxed md:text-lg ${muted}`}>
              KashNode is the automation platform for online stores. Connect your store, your business SIM and your
              courier once — then Kash, the KashNode AI, verifies every customer by SMS and payment code, answers calls
              with no human touch, and books the parcel. No manual checking. No missed orders.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link to="/login" className="flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-300">Start Automating <ArrowRight size={18} /></Link>
              <a href="#how" className="flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 font-semibold hover:bg-white/5"><Play size={16} /> See How It Works</a>
            </motion.div>
            <p className={`mt-6 text-xs ${faint}`}>Store plugin • SMS verification from your SIM • Packages from ৳2,000/mo · Overage ৳7/min</p>
          </div>

          <div className="relative mx-auto max-w-6xl px-5 pb-20">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 shadow-2xl shadow-emerald-500/10">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-slate-100">
                <p className="text-sm font-semibold">app.kashnode — KashNode Central <span className="ml-2 rounded-full bg-emerald-400/20 px-2 py-0.5 text-[11px] text-emerald-300">LIVE PREVIEW</span></p>
                <p className="text-xs text-slate-400">Dashboard · AI Controls ON · Live Calls 2</p>
              </div>
              <div className="grid gap-4 p-5 text-slate-100 md:grid-cols-3">
                <div><p className="text-xs text-slate-400">Package minutes left</p><p className="text-2xl font-extrabold">184 min</p></div>
                <div><p className="text-xs text-slate-400">Verified today</p><p className="text-2xl font-extrabold">৳ 48,290 ▲ auto-matched</p></div>
                <div><p className="text-xs text-slate-400">Kash AI calls · Parcels booked</p><p className="text-2xl font-extrabold">37 ▲ 0 missed · 29 ▲ Steadfast · Pathao</p></div>
              </div>
              <div className="space-y-2 border-t border-white/10 px-5 py-4 font-mono text-sm text-emerald-200">
                <p>#CN-2841 bKash · TrxID 9HX…K42 ✓ VERIFIED ৳ 1,850</p>
                <p>#CN-2840 Steadfast · PIN 4821 ▣ SHIPPED ৳ 2,400</p>
                <p>#CN-2839 Kash is calling customer… ◉ CALLING ৳ 950</p>
                <p className="text-slate-400">bKash Payment Verified — TrxID 9HX72K42 matched → Order #CN-2841 · Amount ৳1,850 · Fraud check passed</p>
              </div>
            </motion.div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className={`rounded-3xl border p-5 ${card}`}>
                <p className="text-xs font-semibold tracking-widest text-emerald-500">Kash AI — Voice Call</p>
                <p className={`mt-2 text-sm ${muted}`}>Example — on the phone, Kash speaks Bangla:</p>
                <p className="mt-2 font-medium">“আপনার পেমেন্টটি পেয়েছি, ধন্যবাদ। পার্সেলটি আজই পাঠানো হচ্ছে।”</p>
              </div>
              <div className={`rounded-3xl border p-5 ${card}`}>
                <p className="text-xs font-semibold tracking-widest text-emerald-500">KashNode Box · Online</p>
                <p className={`mt-2 text-sm ${muted}`}>Your SIM · Signal 5/5 · USB 4G Modem — SMS reader + call interceptor active</p>
                <p className="mt-2 flex items-center gap-2 text-sm font-bold"><PackageCheck size={16} className="text-emerald-400" /> KashNode — automation log · DEMO LOG · PRODUCT PREVIEW — SAMPLE STORE DATA</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <p className={`text-center text-xs font-semibold tracking-widest ${faint}`}>Connects with your store and your courier</p>
          <p className={`mb-3 mt-5 text-center text-sm ${muted}`}>E-commerce</p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className={logoChip}><img src={LOGO_WOOCOMMERCE} alt="WooCommerce logo" className="h-8 object-contain" /></span>
            <span className={logoChip}><img src={LOGO_SHOPIFY} alt="Shopify logo" className="h-8 object-contain" /></span>
          </div>
          <p className={`mb-3 mt-6 text-center text-sm ${muted}`}>Courier</p>
          <div className="flex flex-wrap justify-center gap-3">
            <span className={logoChip}><img src={LOGO_STEADFAST} alt="SteadFast Courier logo" className="h-8 object-contain" /></span>
            <span className={logoChip}><img src={LOGO_PATHAO} alt="Pathao Courier logo" className="h-8 object-contain" /></span>
          </div>
        </section>

        <section id="terminal" className="mx-auto max-w-6xl px-5 pb-20">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 text-slate-100">
              <p className="text-sm font-semibold">Kash AI Terminal <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">DEMO LOG — SAMPLE DATA</span></p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => runTerminal('verify')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${action === 'verify' ? 'bg-emerald-400 text-slate-950' : 'bg-white/10'}`}>Verify COD order</button>
                <button onClick={() => runTerminal('call')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${action === 'call' ? 'bg-emerald-400 text-slate-950' : 'bg-white/10'}`}>Confirm by call</button>
                <button onClick={() => runTerminal('courier')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${action === 'courier' ? 'bg-emerald-400 text-slate-950' : 'bg-white/10'}`}>Book courier</button>
              </div>
            </div>
            <div className="space-y-2 px-5 py-5 font-mono text-sm leading-relaxed text-emerald-200">
              {logs.map((line) => (<p key={line} className="flex gap-2"><span className="text-emerald-500">›</span><span>{line}</span></p>))}
              <p className="flex items-center gap-2 text-slate-400"><PhoneCall size={14} /> Kash is live — listening for the next order, call and payment.</p>
            </div>
          </motion.div>
        </section>

        <section id="platform" className="mx-auto max-w-6xl px-5 pb-20">
          <p className="text-xs font-semibold tracking-widest text-emerald-500">The Platform</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Everything your store needs. One KashNode platform.</h2>
          <p className={`mt-3 max-w-2xl ${muted}`}>Like a cloud platform, but built for online commerce. Each KashNode service runs on its own, scales on its own, and works together out of the box — no glue code, no manual routine.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {platform.map((s) => (
              <article key={s.title} className={`rounded-3xl border p-6 ${card}`}>
                <p className="text-xs font-bold text-emerald-500">{s.tag}</p>
                <h3 className="mt-2 text-lg font-bold">{s.title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{s.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">{s.chips.map((c) => (<span key={c} className={`rounded-full px-3 py-1 text-xs font-bold ${chip}`}>{c}</span>))}</div>
                <a href={s.link} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-emerald-500">{s.linkText} →</a>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-5 pb-20">
          <p className="text-xs font-semibold tracking-widest text-emerald-500">How It Works</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Order in. Verified. Parcel out. Nothing in between is manual.</h2>
          <p className={`mt-3 max-w-2xl ${muted}`}>One order travels through four automated stages — from the Order Now button to a verified customer and a booked parcel — without your team touching it.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <article key={s.title} className={`rounded-3xl border p-6 ${card}`}>
                <p className="text-2xl font-extrabold text-emerald-500">{s.n}</p>
                <h3 className="mt-2 font-bold">{s.title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{s.body}</p>
                <p className={`mt-3 text-xs font-bold ${faint}`}>{s.chip}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="verify" className="mx-auto max-w-6xl px-5 pb-20">
          <p className="text-xs font-semibold tracking-widest text-emerald-500">The Verification System</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Real customers get verified. Fake orders stop at the door.</h2>
          <p className={`mt-3 max-w-2xl ${muted}`}>KashNode verifies people, not just payments. Your own SIM, sitting inside the KashNode Box at your home or office, is what talks to the customer — so every check comes from a number your customers already trust.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <article className={`rounded-3xl border p-6 ${card}`}>
              <h3 className="text-lg font-bold">COD order? Verify by SMS first</h3>
              <ol className={`mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed ${muted}`}>
                <li>Customer places the order — enters their phone number and taps Order Now.</li>
                <li>SMS goes out from your SIM — the KashNode Box sends the verification message.</li>
                <li>Customer enters the code — only a real person holding that phone can complete it.</li>
                <li>You ship with confidence — fake and fraud orders are filtered out before courier cost, packing time and return hassle.</li>
              </ol>
            </article>
            <article className={`rounded-3xl border p-6 ${card}`}>
              <h3 className="text-lg font-bold">Customer calls? The AI picks up</h3>
              <ol className={`mt-3 list-decimal space-y-2 pl-5 text-sm leading-relaxed ${muted}`}>
                <li>Customer dials your SIM number — the same business number printed on your page and parcels.</li>
                <li>The KashNode Box forwards the call — from your SIM to the KashNode central server.</li>
                <li>The server connects the AI — Kash takes the conversation from there.</li>
                <li>Zero human touch — when an order is confirmed or handed to the courier, Kash calls out and tells the customer, automatically.</li>
              </ol>
            </article>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <article className={`rounded-3xl border p-6 ${card}`}><h3 className="font-bold">MFS payment — verified by code</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>The customer pays to your bKash, Nagad, Rocket or Upay number and submits the verification code. KashNode matches the code and TrxID to the order and amount before anything ships.</p></article>
            <article className={`rounded-3xl border p-6 ${card}`}><h3 className="font-bold">Cash on Delivery — fully supported</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>No prepayment? No problem. COD orders run through the same SMS verification, so you still know the customer is real before the rider goes out.</p></article>
          </div>
        </section>

        <section id="mfs" className="mx-auto max-w-6xl px-5 pb-20">
          <p className="text-xs font-semibold tracking-widest text-emerald-500">MFS Payments</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Paid by bKash, Nagad, Rocket or Upay? Verified the same way.</h2>
          <p className={`mt-3 max-w-2xl ${muted}`}>Your customers pay the way they already pay. The payment SMS lands on your own SIM inside the KashNode Box, and KashNode matches the verification code, TrxID and amount to the exact order — before anything ships. No screenshots, no manual checking.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { logo: LOGO_BKASH, alt: 'bKash logo', body: 'Verified by verification code / TrxID against the exact order and amount.' },
              { logo: LOGO_NAGAD, alt: 'Nagad logo', body: 'Nagad payment SMS matched to the order automatically — no screenshot chasing.' },
              { logo: LOGO_ROCKET, alt: 'Rocket logo', body: 'Rocket (Dutch-Bangla Bank) payments checked by code and amount, order by order.' },
              { logo: LOGO_UPAY, alt: 'Upay logo', body: 'Upay payments verified from the payment SMS that arrives on your own SIM.' },
            ].map((m) => (
              <article key={m.alt} className={`rounded-3xl border p-6 ${card}`}>
                <span className={logoChip}><img src={m.logo} alt={m.alt} className="h-10 object-contain" /></span>
                <p className={`mt-4 text-sm leading-relaxed ${muted}`}>{m.body}</p>
              </article>
            ))}
          </div>
          <p className={`mt-4 text-xs font-bold ${faint}`}>PAYMENT SMS ARRIVES ON YOUR SIM, INSIDE THE KASHNODE BOX · CASH ON DELIVERY STAYS FULLY SUPPORTED</p>
        </section>

        <section id="kash" className="mx-auto max-w-6xl px-5 pb-20">
          <p className="text-xs font-semibold tracking-widest text-emerald-500">Meet Kash — The KashNode AI</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Kash doesn’t just read messages. Kash talks to your customers.</h2>
          <p className={`mt-3 max-w-2xl ${muted}`}>Most stores lose orders because nobody picked up the phone. Kash answers every call, confirms the order, checks the payment — and speaks natural Bangla while doing it.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <article className={`rounded-3xl border p-6 ${card}`}><h3 className="font-bold">Listens — Speech to Text</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>Customer speech is transcribed live, Bangla and English mixed, even on a noisy phone line.</p></article>
            <article className={`rounded-3xl border p-6 ${card}`}><h3 className="font-bold">Thinks — LLM reasoning</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>Kash compares what the customer says against the order, the amount and the TrxID — and decides: verified, or needs a human.</p></article>
            <article className={`rounded-3xl border p-6 ${card}`}><h3 className="font-bold">Speaks — Text to Speech, your choice of voice</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>Replies go back as a clear voice on the same call — and you pick the voice: female or male, switchable anytime from your owner app.</p></article>
          </div>
          <div className={`mt-4 rounded-3xl border p-6 ${card}`}>
            <p className="text-sm font-bold">Kash — KashNode AI Voice Agent · INBOUND CALL · CUSTOMER +880 1XXX-XXXXXX</p>
            <p className={`mt-3 text-xs font-bold ${faint}`}>EXAMPLE CALL — ON THE PHONE, KASH AND THE CUSTOMER SPEAK BANGLA:</p>
            <div className="mt-3 space-y-3 text-sm leading-relaxed">
              <p><b>Customer:</b> আমি অর্ডারটা করেছি, বিকাশে টাকা পাঠিয়েছি। TrxID টা হলো 9HX72K42।</p>
              <p><b>Kash · AI:</b> ধন্যবাদ! আপনার TrxID টি যাচাই করছি… পেয়ে গেছি — ৳১,৮৫০ টাকার পেমেন্টটি Order #CN-2841 এর সাথে মিলে গেছে।</p>
              <p><b>Kash · AI:</b> আপনার পার্সেলটি আজই Steadfast-এ বুক করা হয়েছে। ডেলিভারির সময় রাইডারকে PIN টি জানাবেন।</p>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm font-bold"><Check size={16} className="text-emerald-400" /> Payment verified on call — TrxID 9HX72K42 · ৳1,850 · Courier booked · PIN generated</p>
          </div>
        </section>

        <section id="app" className="mx-auto max-w-6xl px-5 pb-20">
          <p className="text-xs font-semibold tracking-widest text-emerald-500">The Owner App</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">You stay in control — from one dashboard.</h2>
          <p className={`mt-3 max-w-2xl ${muted}`}>Every KashNode owner gets the app and dashboard. Watch whether the AI is actually working, listen to what it handled, change its voice, and top up minutes before they run out — no calling anyone, no waiting.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <article className={`rounded-3xl border p-6 ${card}`}><h3 className="font-bold">See the AI working, live</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>Live calls, verifications and bookings appear as they happen — so you can check anytime that Kash is really on the job.</p></article>
            <article className={`rounded-3xl border p-6 ${card}`}><h3 className="font-bold">Change the AI voice</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>Female or male — pick whichever voice fits your brand, and switch whenever you like.</p></article>
            <article className={`rounded-3xl border p-6 ${card}`}><h3 className="font-bold">Recharge minutes in seconds</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>Minutes used up or the month ended? Add balance right inside the app and the AI never stops mid-day.</p></article>
          </div>
          <div className={`mt-4 rounded-3xl border p-6 ${card}`}>
            <p className="flex items-center gap-2 text-sm font-bold"><Smartphone size={16} /> Kash AI status: Working now — answering &amp; verifying · LIVE</p>
            <p className={`mt-4 text-sm ${muted}`}>AI voice — applies to the next call</p>
            <div className="mt-2 flex gap-2">
              {(['Female', 'Male'] as const).map((v) => (
                <button key={v} onClick={() => setVoice(v)} aria-pressed={voice === v} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${voice === v ? 'bg-emerald-400 text-slate-950' : 'bg-white/10'}`}><Mic size={14} /> {v}</button>
              ))}
            </div>
            <p className="mt-4 text-sm font-bold">Package minutes left: {minutes} min <span className={faint}>· Counted from your package · overage ৳7/min</span></p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => setMinutes((m) => m + 60)} className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-emerald-400 hover:text-slate-950"><RefreshCw size={14} /> +60 min · ৳420</button>
              <button onClick={() => setMinutes((m) => m + 150)} className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-emerald-400 hover:text-slate-950"><RefreshCw size={14} /> +150 min · ৳1,050</button>
              <button onClick={() => setMinutes((m) => m + 300)} className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-emerald-400 hover:text-slate-950"><RefreshCw size={14} /> +300 min · ৳2,100</button>
            </div>
            <p className={`mt-3 text-xs ${faint}`}>APP PREVIEW — TRY THE VOICE SWITCH &amp; RECHARGE BUTTONS · Demo only, nothing here is saved.</p>
          </div>
        </section>

        <section id="edge" className="mx-auto max-w-6xl px-5 pb-20">
          <div className={`grid gap-6 rounded-3xl border p-6 md:grid-cols-2 md:p-8 ${card}`}>
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-emerald-500"><Radio size={14} /> KASHNODE BOX — UNIT 01 ● ONLINE</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">One custom-built box. Your SIM inside. Everything flows through it.</h2>
              <p className={`mt-3 leading-relaxed ${muted}`}>We build the KashNode device ourselves and place it at your home or office. Your business SIM stays inside it — sending verification SMS, receiving payment SMS, and forwarding customer calls to the KashNode server, where the AI takes over.</p>
              <ul className={`mt-5 space-y-2 text-sm ${muted}`}>
                <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> DEVICE — Custom-built KashNode Box, with a USB 4G voice modem for calls and SMS on the same hardware.</li>
                <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> SIM — Your business SIM, your number. Customers see messages and calls from the number they already know. The SIM never leaves your premises.</li>
                <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> LINK — Box → Server → AI. Calls forward from the box to the KashNode central server and on to the AI; SMS and events sync the second they arrive.</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950 p-6 text-slate-100">
              <p className="text-sm font-bold">KashNode Box — status</p>
              <div className="mt-4 space-y-2 font-mono text-sm text-emerald-200">
                <p>USB 4G Voice Modem: CONNECTED</p>
                <p>SIM 1 — Your business SIM: 5 / 5</p>
                <p>SIM 2 — Backup SIM: 4 / 5</p>
                <p>Verification SMS Sender: READY</p>
                <p>MFS Payment SMS Reader: LISTENING</p>
                <p>Call Forwarder → KashNode Server → AI: ACTIVE</p>
                <p>Link: WebSocket · 38 ms</p>
                <p>SMS captured today: 112</p>
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 pb-20">
          <p className="text-xs font-semibold tracking-widest text-emerald-500">Pricing</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">One monthly package. Minutes included. No surprises.</h2>
          <p className={`mt-3 max-w-2xl ${muted}`}>Not per-minute alone, and not per-order alone. You buy a simple monthly package sized by your orders — the AI minutes your store needs are already inside it.</p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <article className={`rounded-3xl border p-6 ${card}`}><h3 className="font-bold">WHY 01 — Our cost runs by the minute</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>AI, API and server time is spent while Kash talks — so talk time is honestly counted in minutes.</p></article>
            <article className={`rounded-3xl border p-6 ${card}`}><h3 className="font-bold">WHY 02 — You plan by the order</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>Sellers think in orders per month, not in call minutes — so every package is sized by orders first.</p></article>
            <article className={`rounded-3xl border p-6 ${card}`}><h3 className="font-bold">WHY 03 — The package joins both</h3><p className={`mt-2 text-sm leading-relaxed ${muted}`}>A fixed monthly price with included minutes: a predictable bill for you, and the minute-counting that keeps the AI sustainable. Extra minutes are a flat ৳7/min overage.</p></article>
          </div>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier) => (
              <motion.article key={tier.name} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className={`flex flex-col rounded-3xl border p-6 ${tier.popular ? 'border-emerald-400 bg-emerald-400/10' : card}`}>
                {tier.popular && <span className="mb-3 w-fit rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950">Most Popular</span>}
                <h3 className="font-bold">{tier.name}</h3>
                <p className="mt-3 text-3xl font-extrabold">{tier.price}<span className={`ml-1 text-sm font-medium ${faint}`}>{tier.period}</span></p>
                <p className={`mt-2 text-sm ${muted}`}>{tier.orders}</p>
                <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{tier.desc}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {tier.features.map((f) => (<li key={f} className="flex gap-2"><Check size={16} className="shrink-0 text-emerald-400" /> {f}</li>))}
                </ul>
                <Link to="/login" className="mt-6 rounded-full bg-white/10 py-2.5 text-center text-sm font-bold hover:bg-emerald-400 hover:text-slate-950">{tier.cta}</Link>
              </motion.article>
            ))}
          </div>
          <p className={`mt-4 text-xs font-bold ${faint}`}>EXTRA MINUTES BEYOND YOUR PACKAGE: ৳7/MIN OVERAGE · TOP UP ANYTIME IN THE OWNER APP · MINUTES COUNT AI TALK TIME INSIDE YOUR PACKAGE</p>
          <p className={`mt-2 text-sm ${faint}`}>Effective rates: Basic ≈ ৳6.67/min, Standard ≈ ৳5.50/min, Premium ≈ ৳4.67/min. Package prices cover service and minutes; a separate KashNode Box device price is not stated on this page.</p>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-5 pb-20">
          <p className="text-xs font-semibold tracking-widest text-emerald-500">FAQ</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">Questions store owners ask first</h2>
          <div className="mt-10 space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className={`rounded-3xl border p-5 ${card}`}>
                <summary className="cursor-pointer font-bold">{faq.q}</summary>
                <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="cta" className="mx-auto max-w-6xl px-5 pb-20">
          <div className="rounded-3xl bg-emerald-400 p-8 text-center text-slate-950 md:p-12">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Let KashNode run the routine. You run the business.</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-800">Join the waitlist and be first to put payment verification, customer calls and courier booking on autopilot.</p>
            <Link to="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 font-bold text-white hover:bg-slate-800">Join the Waitlist <ArrowRight size={18} /></Link>
            <p className="mt-4 text-xs text-slate-700">ONBOARDING OPENS IN COHORTS — WAITLIST MEMBERS GO FIRST</p>
          </div>
        </section>
      </main>

      <footer className={`border-t ${isLight ? 'border-slate-200' : 'border-white/10'}`}>
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 text-sm md:grid-cols-4">
          <div>
            <p className="flex items-center gap-2 font-bold"><img src={LOGO_KASHNODE} alt="KashNode logo" className="h-8 w-8 rounded-lg object-cover" /> KashNode</p>
            <p className={`mt-2 ${faint}`}>The AI automation platform for online stores — orders, SMS verification, bKash payments, voice calls and courier booking, run by KashNode.</p>
          </div>
          <div>
            <p className="font-bold">Platform</p>
            <ul className={`mt-2 space-y-1 ${muted}`}><li><a href="#platform">KashNode Central</a></li><li><a href="#kash">Kash AI Worker</a></li><li><a href="#edge">KashNode Box</a></li><li><a href="#how">KashNode Courier</a></li><li><a href="#pricing">KashNode Packages</a></li></ul>
          </div>
          <div>
            <p className="font-bold">Resources</p>
            <ul className={`mt-2 space-y-1 ${muted}`}><li><a href="#how">How It Works</a></li><li><a href="#faq">FAQ</a></li><li><a href="#verify">Integrations</a></li><li><a href="#cta">Waitlist</a></li></ul>
          </div>
          <div>
            <p className="font-bold">Company</p>
            <ul className={`mt-2 space-y-1 ${muted}`}><li>Contact</li><li>Privacy</li><li>Terms</li></ul>
          </div>
        </div>
        <div className={`mx-auto flex max-w-6xl flex-col gap-2 px-5 pb-10 text-xs md:flex-row md:justify-between ${faint}`}>
          <p>© 2026 KashNode — Built for online store owners</p>
          <p>KASHNODE · KASH AI · PACKAGES FROM ৳2,000/MO</p>
        </div>
      </footer>
    </div>
  )
}
