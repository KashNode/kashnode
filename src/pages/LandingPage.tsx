import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Check,
  Mic,
  PackageCheck,
  PhoneCall,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Store,
  Truck,
  Wallet,
} from 'lucide-react'

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

const features = [
  {
    icon: Bot,
    title: 'Kash AI answers the phone',
    body: 'The customer calls your business SIM. The call forwards through KashNode Box to the server, and Kash speaks with the customer — fully automated, no human touch. On the phone, Kash speaks Bangla.',
    span: 'md:col-span-2',
  },
  {
    icon: ShieldCheck,
    title: 'COD verification by SMS',
    body: 'The customer submits a phone number and clicks Order Now. An SMS from your SIM in the box verifies it — proving a real customer and cutting fake COD orders.',
    span: '',
  },
  {
    icon: Wallet,
    title: 'MFS payment verification',
    body: 'bKash payments are verified by verification code / TrxID. COD is also fully supported.',
    span: '',
  },
  {
    icon: Radio,
    title: 'KashNode Box at your office',
    body: 'A custom device at the client home / office holds your SIM and connects your store, calls, SMS and server together.',
    span: '',
  },
  {
    icon: Truck,
    title: 'Automatic courier booking',
    body: 'After verification, parcels are booked automatically with Steadfast / Pathao, with a Rider Secret PIN for safe delivery.',
    span: 'md:col-span-2',
  },
  {
    icon: ShoppingBag,
    title: 'Works with your store',
    body: 'A plugin connects WooCommerce, Shopify or a custom store to the KashNode server and database.',
    span: '',
  },
]

const steps = [
  {
    icon: Store,
    title: '1. Customer clicks Order Now',
    body: 'The customer submits a phone number on your store and places the order.',
  },
  {
    icon: ShieldCheck,
    title: '2. SMS verification from your SIM',
    body: 'An SMS goes out from the owner SIM inside KashNode Box. The customer verifies it, proving a real customer.',
  },
  {
    icon: PhoneCall,
    title: '3. Kash confirms by call',
    body: 'At confirmation, Kash calls the customer — on the phone, Kash speaks Bangla — and confirms the order with no human touch.',
  },
  {
    icon: Truck,
    title: '4. Courier booked automatically',
    body: 'The verified parcel is booked with Steadfast / Pathao, with a Rider Secret PIN for safe handover.',
  },
]

const tiers = [
  {
    name: 'Free Trial',
    price: '৳0',
    period: 'to try it',
    orders: '10 orders',
    minutes: '10 minutes',
    note: 'Test the flow before you pay.',
    popular: false,
  },
  {
    name: 'Basic',
    price: '৳2,000',
    period: '/month',
    orders: '300 orders',
    minutes: '300 minutes',
    note: 'The minimum paid package.',
    popular: false,
  },
  {
    name: 'Standard',
    price: '৳5,500',
    period: '/month',
    orders: '1,000 orders',
    minutes: '1,000 minutes',
    note: 'Best value for growing stores.',
    popular: true,
  },
  {
    name: 'Premium',
    price: '৳14,000',
    period: '/month',
    orders: '3,000 orders',
    minutes: '3,000 minutes',
    note: 'Priority support included.',
    popular: false,
  },
]

const faqs = [
  {
    q: 'What is KashNode?',
    a: 'KashNode is an AI automation system for e-commerce sellers. It connects your store, your SIM in the KashNode Box, and the AI agent Kash, so orders are verified, calls are answered and parcels are booked automatically.',
  },
  {
    q: 'How does COD verification work?',
    a: 'The customer submits a phone number and clicks Order Now. An SMS is sent from the business owner’s SIM inside the KashNode Box, and the customer verifies it. That proves a real customer and greatly reduces fake or fraud COD orders.',
  },
  {
    q: 'How does Kash answer customer calls?',
    a: 'The customer calls the business SIM. The call forwards through the KashNode Box to the central server, and Kash speaks with the customer. No human touch is needed. On the phone, Kash speaks Bangla.',
  },
  {
    q: 'How are bKash and other MFS payments verified?',
    a: 'MFS payments are verified by verification code / TrxID. COD is also fully supported, so a store can use both payment methods.',
  },
  {
    q: 'How are couriers booked?',
    a: 'After verification, parcels are booked automatically with Steadfast / Pathao, and a Rider Secret PIN is generated for safe handover. The customer is notified by phone call at confirmation.',
  },
  {
    q: 'How does pricing and minutes work?',
    a: 'Packages are sized by orders, with minutes included inside, because AI cost is per minute but sellers plan per order. Overage is a flat ৳7/minute, with in-app minute recharge.',
  },
  {
    q: 'What is KashNode Box, and is its price included?',
    a: 'KashNode Box is the custom device at the client home or office that holds the business SIM and connects the store, calls, SMS and server. Package prices cover service and minutes. A separate KashNode Box device price is not included here yet, and no device price is stated on this page.',
  },
  {
    q: 'Can the owner change the AI voice or recharge minutes?',
    a: 'Yes. In the owner app / dashboard, the owner can check whether Kash is actually working, change the AI voice between female and male, and add or recharge minutes when a month’s minutes run out.',
  },
]

type Theme = 'dark' | 'system' | 'custom'

export default function LandingPage() {
  const [action, setAction] = useState<TerminalAction>('verify')
  const [logs, setLogs] = useState<string[]>([...terminalSteps.verify])
  const [theme, setTheme] = useState<Theme>('dark')
  const [systemDark, setSystemDark] = useState(true)
  const [voice, setVoice] = useState<'Female' | 'Male'>('Female')
  const [minutes, setMinutes] = useState(300)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setSystemDark(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Theme is not saved: a reload returns to Dark, as on the front page.
  const isLight = theme === 'custom' || (theme === 'system' && !systemDark)
  const page = isLight ? 'bg-white text-slate-900' : 'bg-[#04070d] text-slate-100'
  const header = isLight
    ? 'border-slate-200 bg-white/85'
    : 'border-white/10 bg-[#04070d]/80'
  const muted = isLight ? 'text-slate-600' : 'text-slate-300'
  const faint = isLight ? 'text-slate-500' : 'text-slate-400'
  const card = isLight
    ? 'border-slate-200 bg-slate-50 hover:border-teal-500/50'
    : 'border-white/10 bg-white/[0.04] hover:border-emerald-400/40'
  const chip = isLight ? 'bg-slate-100 text-slate-700' : 'bg-white/10 text-slate-200'
  const sectionBorder = isLight ? 'border-slate-200' : 'border-white/10'

  function runTerminal(next: TerminalAction) {
    setAction(next)
    setLogs([...terminalSteps[next]])
  }

  return (
    <div className={`min-h-screen antialiased ${page}`}>
      <div className="bg-emerald-400 px-5 py-2 text-center text-xs font-bold text-slate-950">
        KashNode is live — COD verification, Bangla AI calls and automatic courier booking, with no human touch.
      </div>

      <header className={`sticky top-0 z-40 border-b backdrop-blur ${header}`}>
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-emerald-400 to-lime-300 text-lg text-slate-950">K</span>
            KashNode
          </Link>
          <nav className={`hidden items-center gap-6 text-sm lg:flex ${muted}`}>
            <a href="#features" className="hover:text-emerald-500">Features</a>
            <a href="#how" className="hover:text-emerald-500">How it works</a>
            <a href="#box" className="hover:text-emerald-500">KashNode Box</a>
            <a href="#pricing" className="hover:text-emerald-500">Pricing</a>
            <a href="#faq" className="hover:text-emerald-500">FAQ</a>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`flex rounded-full p-1 text-xs font-bold ${isLight ? 'bg-slate-100' : 'bg-white/10'}`}
              title="Theme is not saved — a reload returns to Dark"
            >
              {(['dark', 'system', 'custom'] as Theme[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  aria-pressed={theme === t}
                  className={`rounded-full px-3 py-1 capitalize ${theme === t ? 'bg-emerald-400 text-slate-950' : ''}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Link to="/login" className={`hidden text-sm sm:inline ${muted}`}>Sign in</Link>
            <Link to="/login" className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-300">
              Start for Free
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 text-center md:pt-24">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-widest text-emerald-300"
            >
              <Sparkles size={14} /> AI-DRIVEN COMMERCE OPERATIONS
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl"
            >
              Let Kash answer, verify and ship — while you sell.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className={`mx-auto mt-5 max-w-2xl text-base leading-relaxed md:text-lg ${muted}`}
            >
              KashNode connects your store, your SIM and an AI agent. It verifies COD
              orders by SMS, verifies bKash payments, answers customer calls and books
              couriers automatically — with no human touch.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <Link to="/login" className="flex items-center gap-2 rounded-full bg-emerald-400 px-6 py-3 font-bold text-slate-950 hover:bg-emerald-300">
                Start for Free <ArrowRight size={18} />
              </Link>
              <a href="#terminal" className="flex items-center gap-2 rounded-full border border-white/20 px-6 py-3 font-semibold hover:bg-white/5">
                <Play size={16} /> See Kash at work
              </a>
            </motion.div>
            <p className={`mt-6 text-xs ${faint}`}>Free trial: 10 orders / 10 minutes · No card needed to try the flow</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-16">
          <p className={`text-center text-xs font-semibold tracking-widest ${faint}`}>WORKS WITH YOUR STORE AND COURIERS</p>
          <div className="mt-5">
            <p className={`mb-2 text-center text-sm ${muted}`}>E-commerce first</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['WooCommerce', 'Shopify', 'Custom store'].map((name) => (
                <span key={name} className={`rounded-full px-4 py-2 text-sm font-bold ${chip}`}>{name}</span>
              ))}
            </div>
            <p className={`mb-2 mt-5 text-center text-sm ${muted}`}>Then courier</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Steadfast', 'Pathao Courier'].map((name) => (
                <span key={name} className={`rounded-full px-4 py-2 text-sm font-bold ${chip}`}>{name}</span>
              ))}
            </div>
          </div>
        </section>

        <section id="terminal" className="mx-auto max-w-6xl px-5 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/80 shadow-2xl shadow-emerald-500/10"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-2 text-slate-100">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-300" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-sm font-semibold">Kash AI Terminal</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">DEMO LOG — SAMPLE DATA</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => runTerminal('verify')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${action === 'verify' ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-100'}`}>Verify COD order</button>
                <button onClick={() => runTerminal('call')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${action === 'call' ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-100'}`}>Confirm by call</button>
                <button onClick={() => runTerminal('courier')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${action === 'courier' ? 'bg-emerald-400 text-slate-950' : 'bg-white/10 text-slate-100'}`}>Book courier</button>
              </div>
            </div>
            <div className="space-y-2 px-5 py-5 font-mono text-sm leading-relaxed text-emerald-200">
              {logs.map((line) => (
                <p key={line} className="flex gap-2"><span className="text-emerald-500">›</span><span>{line}</span></p>
              ))}
              <p className="flex items-center gap-2 text-slate-400">
                <PhoneCall size={14} /> Kash is live — listening for the next order, call and payment.
              </p>
            </div>
          </motion.div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Everything after “Order Now”, automated</h2>
          <p className={`mt-3 max-w-2xl ${muted}`}>From SMS verification to the courier handover, KashNode keeps the whole flow moving without a human in the middle.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-3xl border p-6 ${card} ${feature.span}`}
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><feature.icon size={20} /></span>
                <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{feature.body}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">How it works, in four steps</h2>
          <p className={`mt-3 max-w-2xl ${muted}`}>No human touch from order to courier — the box, the server and Kash handle the flow.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <article key={step.title} className={`rounded-3xl border p-6 ${card}`}>
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><step.icon size={20} /></span>
                <h3 className="mt-4 font-bold">{step.title}</h3>
                <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{step.body}</p>
              </article>
            ))}
          </div>
          <p className={`mt-4 text-sm ${faint}`}>
            Phone example, in English context: on the phone, Kash speaks Bangla — for example, “আপনার অর্ডার কনফার্ম হয়েছে, পার্সেল প্রস্তুত হচ্ছে।”
          </p>
        </section>

        <section id="verify" className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Verification that stops fake orders</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <article className={`rounded-3xl border p-6 ${card}`}>
              <h3 className="text-lg font-bold">COD verification by SMS</h3>
              <p className={`mt-2 text-sm leading-relaxed ${muted}`}>
                The customer submits a phone number and clicks Order Now. An SMS from the business owner’s SIM inside
                KashNode Box verifies the order, proving a real customer and cutting fake / fraud COD orders.
              </p>
            </article>
            <article className={`rounded-3xl border p-6 ${card}`}>
              <h3 className="text-lg font-bold">MFS verification by code / TrxID</h3>
              <p className={`mt-2 text-sm leading-relaxed ${muted}`}>
                If the customer pays to a bKash number, the payment is verified by verification code / TrxID.
                COD is also fully supported.
              </p>
            </article>
          </div>
        </section>

        <section id="box" className="mx-auto max-w-6xl px-5 pb-20">
          <div className={`grid gap-6 rounded-3xl border p-6 md:grid-cols-2 md:p-8 ${card}`}>
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-emerald-500"><Radio size={14} /> KASHNODE BOX</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight">A small device at your office, doing the talking</h2>
              <p className={`mt-3 leading-relaxed ${muted}`}>
                KashNode Box sits at the client home / office with your business SIM inside. It connects your store,
                calls, SMS and the central server — so a customer call forwards through the box to Kash, and an
                order SMS goes out from your own SIM.
              </p>
              <ul className={`mt-5 space-y-2 text-sm ${muted}`}>
                <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> Holds the business SIM</li>
                <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> Connects store, calls, SMS and server</li>
                <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> Fully automated, no human touch</li>
              </ul>
              <p className={`mt-4 text-sm ${faint}`}>Package prices cover service and minutes. A separate KashNode Box device price is not included here yet.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-slate-950 p-6 text-slate-100">
              <p className="text-sm font-bold">KashNode Box — live preview</p>
              <p className="mt-1 text-xs text-slate-400">DEMO — SAMPLE DATA</p>
              <div className="mt-5 space-y-3 font-mono text-sm text-emerald-200">
                <p>SIM: connected</p>
                <p>Store: WooCommerce / Shopify plugin</p>
                <p>Calls: forwarding to Kash AI</p>
                <p>SMS: sending from owner SIM</p>
                <p className="text-slate-400">Status: Kash is live</p>
              </div>
            </div>
          </div>
        </section>

        <section id="payments" className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Pay by MFS, verified by code</h2>
          <p className={`mt-3 max-w-2xl ${muted}`}>MFS payments are verified by verification code / TrxID. COD is also fully supported.</p>
          <div className="mt-8 flex flex-wrap gap-2">
            {['bKash', 'Nagad', 'Rocket', 'Upay'].map((name) => (
              <span key={name} className={`rounded-full px-5 py-2.5 text-sm font-bold ${chip}`}>{name}</span>
            ))}
          </div>
          <p className={`mt-4 text-sm ${faint}`}>Brand names are shown as text here, so no fake logo is used. Payment verification is by code / TrxID, not by a logo.</p>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Predictable monthly packages</h2>
          <p className={`mt-3 max-w-2xl ${muted}`}>Packages are sized by orders, with minutes included inside — because AI cost is per minute, but sellers plan per order. Overage is a flat ৳7/minute, with in-app minute recharge.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier) => (
              <motion.article
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                className={`flex flex-col rounded-3xl border p-6 ${tier.popular ? 'border-emerald-400 bg-emerald-400/10' : card}`}
              >
                {tier.popular && <span className="mb-3 w-fit rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950">Most Popular</span>}
                <h3 className="font-bold">{tier.name}</h3>
                <p className="mt-3 text-3xl font-extrabold">{tier.price}<span className={`ml-1 text-sm font-medium ${faint}`}>{tier.period}</span></p>
                <ul className="mt-5 space-y-2 text-sm">
                  <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> {tier.orders}</li>
                  <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> {tier.minutes}</li>
                  <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> {tier.note}</li>
                </ul>
                <Link to="/login" className="mt-6 rounded-full bg-white/10 py-2.5 text-center text-sm font-bold hover:bg-emerald-400 hover:text-slate-950">Start for Free</Link>
              </motion.article>
            ))}
          </div>
          <p className={`mt-4 text-sm ${faint}`}>Package prices cover service and minutes. A separate KashNode Box device price is not included here yet.</p>
        </section>

        <section id="owner" className="mx-auto max-w-6xl px-5 pb-20">
          <div className={`rounded-3xl border p-6 md:p-8 ${card}`}>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-widest text-emerald-500"><Smartphone size={16} /> OWNER APP PREVIEW</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight">Check that Kash is actually working</h2>
            <p className={`mt-3 max-w-2xl ${muted}`}>
              The owner app / dashboard shows whether Kash is working, lets the owner change the AI voice, and lets
              them recharge minutes when a month’s minutes run out. This preview is a demo only — nothing here is saved.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <div className={`rounded-2xl border p-5 ${sectionBorder}`}>
                <p className={`text-sm ${faint}`}>Kash status</p>
                <p className="mt-2 flex items-center gap-2 font-bold"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Live — answering calls</p>
              </div>
              <div className={`rounded-2xl border p-5 ${sectionBorder}`}>
                <p className={`text-sm ${faint}`}>AI voice</p>
                <div className="mt-3 flex gap-2">
                  {(['Female', 'Male'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVoice(v)}
                      aria-pressed={voice === v}
                      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${voice === v ? 'bg-emerald-400 text-slate-950' : 'bg-white/10'}`}
                    >
                      <Mic size={14} /> {v}
                    </button>
                  ))}
                </div>
                <p className={`mt-3 text-sm ${muted}`}>Current voice: {voice}</p>
              </div>
              <div className={`rounded-2xl border p-5 ${sectionBorder}`}>
                <p className={`text-sm ${faint}`}>Minutes left (demo)</p>
                <p className="mt-2 text-2xl font-extrabold">{minutes} minutes</p>
                <button
                  onClick={() => setMinutes((m) => m + 100)}
                  className="mt-3 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold hover:bg-emerald-400 hover:text-slate-950"
                >
                  <RefreshCw size={14} /> Recharge +100 minutes (demo)
                </button>
              </div>
            </div>
            <p className={`mt-4 flex items-center gap-2 text-sm ${faint}`}><PackageCheck size={16} /> After verification, parcels are booked automatically with Steadfast / Pathao.</p>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Frequently asked questions</h2>
          <div className="mt-10 space-y-3">
            {faqs.map((faq) => (
              <details key={faq.q} className={`rounded-3xl border p-5 ${card}`}>
                <summary className="cursor-pointer font-bold">{faq.q}</summary>
                <p className={`mt-2 text-sm leading-relaxed ${muted}`}>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 pb-20">
          <div className="rounded-3xl bg-emerald-400 p-8 text-center text-slate-950 md:p-12">
            <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Start verifying orders today</h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-800">Try the free trial — 10 orders / 10 minutes — and let Kash answer, verify and ship while you sell.</p>
            <Link to="/login" className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-6 py-3 font-bold text-white hover:bg-slate-800">
              Start for Free <ArrowRight size={18} />
            </Link>
            <p className="mt-4 text-xs text-slate-700">No card needed to try the flow.</p>
          </div>
        </section>
      </main>

      <footer className={`border-t ${sectionBorder}`}>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>
            <p className={`font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>KashNode</p>
            <p>AI-driven commerce operations.</p>
          </div>
          <nav className="flex flex-wrap gap-5">
            <a href="#features" className="hover:text-emerald-500">Features</a>
            <a href="#how" className="hover:text-emerald-500">How it works</a>
            <a href="#box" className="hover:text-emerald-500">KashNode Box</a>
            <a href="#pricing" className="hover:text-emerald-500">Pricing</a>
            <a href="#faq" className="hover:text-emerald-500">FAQ</a>
            <Link to="/login" className="hover:text-emerald-500">Sign in</Link>
          </nav>
          <p>© KashNode. Built for sellers who want orders verified, calls answered and parcels shipped automatically.</p>
        </div>
      </footer>
    </div>
  )
}
