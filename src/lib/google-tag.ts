/**
 * Which Google tag to load, if any. IDs come from build-time env and go into a
 * script URL, so anything that isn't the exact expected shape is ignored.
 *
 * GTM wins when both are set: GA4 normally lives inside the container, and
 * loading gtag.js as well would count every page view twice.
 */

export type GoogleTagPlan = { kind: 'ga4' | 'gtm'; id: string }

const GA4_ID = /^G-[A-Z0-9]+$/
const GTM_ID = /^GTM-[A-Z0-9]+$/

export function googleTagPlan(
    ga4Id: string | undefined,
    gtmId: string | undefined,
): GoogleTagPlan | null {
    const gtm = gtmId?.trim()
    if (gtm && GTM_ID.test(gtm)) return { kind: 'gtm', id: gtm }
    const ga4 = ga4Id?.trim()
    if (ga4 && GA4_ID.test(ga4)) return { kind: 'ga4', id: ga4 }
    return null
}

export function googleTagUrl(plan: GoogleTagPlan): string {
    const file = plan.kind === 'gtm' ? 'gtm.js' : 'gtag/js'
    return `https://www.googletagmanager.com/${file}?id=${plan.id}`
}
