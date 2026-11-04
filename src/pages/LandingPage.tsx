import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Check,
  MessageSquareText,
  PhoneCall,
  Play,
  Radio,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
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

export default function LandingPage() {
  const [action, setAction] = useState<TerminalAction>('verify')
  const [logs, setLogs] = useState<string[]>([...terminalSteps.verify])

  function runTerminal(next: TerminalAction) {
    setAction(next)
    setLogs([...terminalSteps[next]])
  }

  return (
    <div className="min-h-screen bg-[#04070d] text-slate-100 antialiased">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#04070d]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 via-emerald-400 to-lime-300 text-lg text-slate-950">K</span>
            KashNode
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#terminal" className="hover:text-white">AI Terminal</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden text-sm text-slate-300 hover:text-white sm:inline">Sign in</Link>
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
              className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-300 md:text-lg"
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
            <p className="mt-6 text-xs text-slate-400">Free trial: 10 orders / 10 minutes · No card needed to try the flow</p>
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
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-300" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-sm font-semibold">Kash AI Terminal</span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-300">DEMO LOG — SAMPLE DATA</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => runTerminal('verify')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${action === 'verify' ? 'bg-emerald-400 text-slate-950' : 'bg-white/10'}`}>Verify COD order</button>
                <button onClick={() => runTerminal('call')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${action === 'call' ? 'bg-emerald-400 text-slate-950' : 'bg-white/10'}`}>Confirm by call</button>
                <button onClick={() => runTerminal('courier')} className={`rounded-full px-3 py-1.5 text-xs font-bold ${action === 'courier' ? 'bg-emerald-400 text-slate-950' : 'bg-white/10'}`}>Book courier</button>
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
          <p className="mt-3 max-w-2xl text-slate-300">From SMS verification to the courier handover, KashNode keeps the whole flow moving without a human in the middle.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {features.map((feature, index) => (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ delay: index * 0.05 }}
                className={`rounded-3xl border border-white/10 bg-white/[0.04] p-6 hover:border-emerald-400/40 ${feature.span}`}
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300"><feature.icon size={20} /></span>
                <h3 className="mt-4 text-lg font-bold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{feature.body}</p>
              </motion.article>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <MessageSquareText size={14} /> MFS: <span className="rounded-full bg-white/10 px-3 py-1">bKash</span><span className="rounded-full bg-white/10 px-3 py-1">Nagad</span><span className="rounded-full bg-white/10 px-3 py-1">Rocket</span><span className="rounded-full bg-white/10 px-3 py-1">Upay</span>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-6xl px-5 pb-20">
          <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Predictable monthly packages</h2>
          <p className="mt-3 max-w-2xl text-slate-300">Packages are sized by orders, with minutes included inside — because AI cost is per minute, but sellers plan per order. Overage is a flat ৳7/minute, with in-app minute recharge.</p>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {tiers.map((tier) => (
              <motion.article
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                className={`flex flex-col rounded-3xl border p-6 ${tier.popular ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/10 bg-white/[0.04]'}`}
              >
                {tier.popular && <span className="mb-3 w-fit rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-slate-950">Most Popular</span>}
                <h3 className="font-bold">{tier.name}</h3>
                <p className="mt-3 text-3xl font-extrabold">{tier.price}<span className="ml-1 text-sm font-medium text-slate-400">{tier.period}</span></p>
                <ul className="mt-5 space-y-2 text-sm text-slate-200">
                  <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> {tier.orders}</li>
                  <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> {tier.minutes}</li>
                  <li className="flex gap-2"><Check size={16} className="text-emerald-400" /> {tier.note}</li>
                </ul>
                <Link to="/login" className="mt-6 rounded-full bg-white/10 py-2.5 text-center text-sm font-bold hover:bg-emerald-400 hover:text-slate-950">Start for Free</Link>
              </motion.article>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-400">Package prices cover service and minutes. A separate KashNode Box device price is not included here yet.</p>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-bold text-white">KashNode</p>
            <p>AI-driven commerce operations.</p>
          </div>
          <nav className="flex gap-5">
            <a href="#features" className="hover:text-white">Features</a>
            <a href="#pricing" className="hover:text-white">Pricing</a>
            <Link to="/login" className="hover:text-white">Sign in</Link>
          </nav>
          <p>© KashNode. Built for sellers who want orders verified, calls answered and parcels shipped automatically.</p>
        </div>
      </footer>
    </div>
  )
}
