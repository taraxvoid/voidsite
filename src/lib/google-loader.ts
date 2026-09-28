/**
 * Browser side of the Google tag. Only ever called after consent.
 */
import { consentModeFor, isGoogleCookie } from './consent'
import { type GoogleTagPlan, googleTagUrl } from './google-tag'

type GtagWindow = Window & {
    dataLayer?: unknown[]
    __googleTagLoaded?: boolean
}

// GA4's documented opt-out switch is a global named ga-disable-<ID>.
const disableKey = (plan: GoogleTagPlan) => `ga-disable-${plan.id}`

function gtagFor(w: GtagWindow) {
    w.dataLayer = w.dataLayer || []
    const layer = w.dataLayer
    return function gtag(..._args: unknown[]) {
        // biome-ignore lint/complexity/noArguments: gtag.js requires the real arguments object, not an array
        layer.push(arguments)
    }
}

export function loadGoogleTag(plan: GoogleTagPlan): void {
    const w = window as GtagWindow
    if (w.__googleTagLoaded) return
    w.__googleTagLoaded = true
    Reflect.deleteProperty(w, disableKey(plan))

    const gtag = gtagFor(w)
    // Denied first, then the visitor's grant, so tags see both in order.
    gtag('consent', 'default', consentModeFor('denied'))
    gtag('consent', 'update', consentModeFor('granted'))
    if (plan.kind === 'gtm') {
        w.dataLayer?.push({ 'gtm.start': Date.now(), event: 'gtm.js' })
    } else {
        gtag('js', new Date())
        gtag('config', plan.id)
    }

    const script = document.createElement('script')
    script.async = true
    script.src = googleTagUrl(plan)
    document.head.appendChild(script)
}

// Withdrawing consent: stop measuring and remove the cookies Google set.
export function withdrawGoogleTag(plan: GoogleTagPlan): void {
    const w = window as GtagWindow
    Reflect.set(w, disableKey(plan), true)
    if (w.__googleTagLoaded) {
        gtagFor(w)('consent', 'update', consentModeFor('denied'))
    }

    const host = location.hostname
    const parts = host.split('.')
    const domains = ['', host]
    for (let i = 1; i < parts.length - 1; i++) {
        domains.push(`.${parts.slice(i).join('.')}`)
    }
    for (const entry of document.cookie.split(';')) {
        const name = entry.split('=')[0]?.trim()
        if (!name || !isGoogleCookie(name)) continue
        for (const domain of domains) {
            // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not available in all supported browsers
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain ? `; domain=${domain}` : ''}`
        }
    }
}
