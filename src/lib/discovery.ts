/**
 * Discovery files per context (W10, spec section 4.4): which sitemap a
 * context serves, its llms.txt, and the identity its JSON-LD describes.
 * Pure; the routes in src/pages and Base.astro read the request's context
 * from Astro.locals and pass it in.
 */
import type { SiteContext } from './context'
import type { SiteIdentity } from './structured-data'

/** Pages every context serves, outside Emdash content. */
export const FIXED_PAGES = [
    {
        name: 'Privacy',
        path: '/privacy',
        note: 'What data is collected and why',
    },
    { name: 'Terms', path: '/terms', note: 'Terms of use' },
    {
        name: 'Accessibility',
        path: '/accessibility',
        note: 'Accessibility approach and known gaps',
    },
] as const

/**
 * What /sitemap.xml answers in a context:
 * - `none`: the context is not indexable, so there is no sitemap (404).
 * - `emdash`: the canonical context keeps Emdash's sitemap index, which
 *   lists published content at the canonical origin.
 * - `fixed`: any other context lists its own fixed pages at its own origin.
 *   Content has no context of its own yet (slice 4 adds the `contexts`
 *   field; until then every entry belongs to the canonical context).
 */
export type SitemapPlan =
    | { kind: 'none' }
    | { kind: 'emdash' }
    | { kind: 'fixed'; urls: string[] }

export function sitemapPlan(
    context: SiteContext,
    origin: string,
    paths: readonly string[],
): SitemapPlan {
    if (!context.indexable) return { kind: 'none' }
    if (context.canonical) return { kind: 'emdash' }
    return { kind: 'fixed', urls: paths.map((p) => `${origin}${p}`) }
}

/** The fixed paths a context's own sitemap lists. */
export function fixedPaths(contactEnabled: boolean): string[] {
    return [
        '/',
        ...FIXED_PAGES.map((p) => p.path),
        ...(contactEnabled ? ['/contact'] : []),
    ]
}

const XML_ESCAPES: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
}

const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => XML_ESCAPES[c])

/** A plain sitemap urlset. */
export function urlsetXml(urls: readonly string[]): string {
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`),
        '</urlset>',
        '',
    ].join('\n')
}

export interface LlmsOptions {
    context: SiteContext
    origin: string
    contactEmail: string
}

/**
 * https://llmstxt.org: a short markdown map of the context. Emdash content
 * is dynamic, so it lists the fixed pages and the sitemap. Posts are listed
 * on the canonical context only, where content lives until slice 4.
 */
export function llmsTxt({
    context,
    origin,
    contactEmail,
}: LlmsOptions): string {
    const pages = [
        `- [Home](${origin}/): Latest content`,
        ...(context.canonical ? [`- [Posts](${origin}/posts): All posts`] : []),
        ...FIXED_PAGES.map(
            (p) => `- [${p.name}](${origin}${p.path}): ${p.note}`,
        ),
    ]
    return `# ${context.name}

> ${context.description}

## Pages

${pages.join('\n')}

## Sitemap

- [sitemap.xml](${origin}/sitemap.xml): every published page

## Contact

- Email: ${contactEmail}
`
}

/**
 * Who a page's JSON-LD describes. A single-context site describes the site
 * as configured. With several contexts each one is its own organization at
 * its own domain, and names the other indexable ones in `sameAs`.
 */
export function contextIdentity(
    site: SiteIdentity,
    context: SiteContext,
    contexts: readonly SiteContext[],
): SiteIdentity {
    if (contexts.length < 2) return site
    return {
        ...site,
        name: context.name,
        description: context.description,
        url: `https://${context.host}`,
        business: {
            ...site.business,
            sameAs: [
                ...site.business.sameAs,
                ...contexts
                    .filter((c) => c.id !== context.id && c.indexable)
                    .map((c) => `https://${c.host}/`),
            ],
        },
    }
}
