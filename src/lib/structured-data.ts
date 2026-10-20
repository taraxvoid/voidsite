/**
 * JSON-LD that describes the business, built from site.config.ts. Pure, so
 * every shape is unit-tested; Base.astro renders it on every page.
 */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

export interface BusinessConfig {
    type: string
    logo: string
    telephone: string
    address: Record<string, string>
    areaServed: string
    sameAs: string[]
    services: { name: string; description: string }[]
}

export interface SiteIdentity {
    name: string
    description: string
    url: string
    contactEmail: string
    business: BusinessConfig
}

/** Drop empty strings, empty arrays and empty objects, recursively. */
export const compact = (value: Json): Json | undefined => {
    if (typeof value === 'string') return value === '' ? undefined : value
    if (Array.isArray(value)) {
        const items = value
            .map(compact)
            .filter((v): v is Json => v !== undefined)
        return items.length === 0 ? undefined : items
    }
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value)
            .map(([k, v]) => [k, compact(v)] as const)
            .filter((e): e is [string, Json] => e[1] !== undefined)
        // An object holding nothing but its @type says nothing.
        if (entries.length === 0) return undefined
        if (entries.length === 1 && entries[0]?.[0] === '@type')
            return undefined
        return Object.fromEntries(entries)
    }
    return value
}

const TYPE = /^[A-Z][A-Za-z]+$/

export const businessSchema = (site: SiteIdentity) => {
    const b = site.business
    const type = TYPE.test(b.type) ? b.type : 'Organization'
    const provider = { '@type': type, name: site.name }
    return compact({
        '@context': 'https://schema.org',
        '@type': type,
        '@id': `${site.url}/#business`,
        name: site.name,
        description: site.description,
        url: site.url,
        logo: b.logo,
        email: site.contactEmail,
        telephone: b.telephone,
        address: { '@type': 'PostalAddress', ...b.address },
        areaServed: b.areaServed,
        sameAs: b.sameAs,
        hasOfferCatalog:
            b.services.length === 0
                ? ''
                : {
                      '@type': 'OfferCatalog',
                      name: `${site.name} services`,
                      itemListElement: b.services.map((s) => ({
                          '@type': 'Offer',
                          itemOffered: {
                              '@type': 'Service',
                              name: s.name,
                              description: s.description,
                              provider,
                          },
                      })),
                  },
    }) as Record<string, Json>
}

export const faqSchema = (items: { question: string; answer: string }[]) =>
    items.length === 0
        ? null
        : {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: items.map((i) => ({
                  '@type': 'Question',
                  name: i.question,
                  acceptedAnswer: { '@type': 'Answer', text: i.answer },
              })),
          }

/** Escape `<` so a stray "</script>" in any field can't end the tag. */
export const toJsonLdScript = (value: unknown) =>
    JSON.stringify(value).replace(/</g, '\\u003c')
