import { useEffect, useRef, useState } from 'react'
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

declare global {
  interface Window {
    __kashnodeLandingCleanup?: () => void
  }
}

const LOGO_SOURCES: Record<string, string> = {
  kashnode: LOGO_KASHNODE,
  woocommerce: LOGO_WOOCOMMERCE,
  shopify: LOGO_SHOPIFY,
  steadfast: LOGO_STEADFAST,
  pathao: LOGO_PATHAO,
  bkash: LOGO_BKASH,
  nagad: LOGO_NAGAD,
  rocket: LOGO_ROCKET,
  upay: LOGO_UPAY,
}

const PAGE_TITLE = 'KashNode — AI Verification & Automation for Online Stores'
const PAGE_DESCRIPTION = 'KashNode verifies your customers by SMS from your own business SIM, checks bKash, Nagad, Rocket and Upay payments by code, and Kash — the KashNode AI — answers and makes confirmation calls, with no human touch. WooCommerce, Shopify and custom stores, on monthly packages with minutes included, from ৳2,000 a month.'
const FONT_STYLESHEET = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap'

export default function LandingPage() {
  const mountRef = useRef<HTMLDivElement>(null)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    const injectedLinks: HTMLLinkElement[] = []
    let landingScript: HTMLScriptElement | null = null
    const previousTitle = document.title
    const previousTheme = document.documentElement.getAttribute('data-theme')
    const descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previousDescription = descriptionMeta?.content

    const appendLink = (rel: string, href: string, crossOrigin?: string) => {
      const link = document.createElement('link')
      link.rel = rel
      link.href = href
      if (crossOrigin) link.crossOrigin = crossOrigin
      link.dataset.kashnodeLanding = 'true'
      document.head.appendChild(link)
      injectedLinks.push(link)
      return link
    }

    async function mountLandingPage() {
      try {
        const response = await fetch('/kashnode-front-page.html', {
          credentials: 'same-origin',
          signal: controller.signal,
        })
        if (!response.ok) throw new Error(`Landing page assets returned HTTP ${response.status}.`)
        const markup = await response.text()
        if (disposed || !mountRef.current) return

        appendLink('preconnect', 'https://fonts.googleapis.com')
        appendLink('preconnect', 'https://fonts.gstatic.com', 'anonymous')
        appendLink('stylesheet', FONT_STYLESHEET)
        const cssLink = appendLink('stylesheet', '/kashnode-front-page.css')
        await new Promise<void>(resolve => {
          if ((cssLink as HTMLLinkElement & { sheet: CSSStyleSheet | null }).sheet) resolve()
          else {
            cssLink.addEventListener('load', () => resolve(), { once: true })
            cssLink.addEventListener('error', () => resolve(), { once: true })
          }
        })
        if (disposed || !mountRef.current) return

        mountRef.current.innerHTML = markup
        mountRef.current.querySelectorAll<HTMLImageElement>('img[data-kashnode-logo]').forEach(image => {
          const key = image.dataset.kashnodeLogo || ''
          const src = LOGO_SOURCES[key]
          if (src) image.src = src
        })

        document.title = PAGE_TITLE
        if (descriptionMeta) descriptionMeta.content = PAGE_DESCRIPTION
        document.documentElement.setAttribute('data-theme', 'dark')

        landingScript = document.createElement('script')
        landingScript.src = '/kashnode-front-page.js'
        landingScript.async = false
        landingScript.dataset.kashnodeLanding = 'true'
        document.body.appendChild(landingScript)
      } catch (error) {
        if (disposed || (error instanceof DOMException && error.name === 'AbortError')) return
        setLoadError(error instanceof Error ? error.message : 'The KashNode landing page could not be loaded.')
      }
    }

    void mountLandingPage()

    return () => {
      disposed = true
      controller.abort()
      window.__kashnodeLandingCleanup?.()
      delete window.__kashnodeLandingCleanup
      landingScript?.remove()
      injectedLinks.forEach(link => link.remove())
      mountRef.current?.replaceChildren()
      document.title = previousTitle
      if (descriptionMeta && previousDescription !== undefined) descriptionMeta.content = previousDescription
      if (previousTheme === null) document.documentElement.removeAttribute('data-theme')
      else document.documentElement.setAttribute('data-theme', previousTheme)
    }
  }, [])

  return (
    <div className="kashnode-reference-landing" ref={mountRef} data-theme="dark">
      {loadError ? (
        <div role="alert" style={{ padding: 32, textAlign: 'center' }}>
          KashNode landing page failed to load. {loadError}
        </div>
      ) : null}
    </div>
  )
}
