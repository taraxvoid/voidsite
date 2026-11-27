import { describe, expect, test } from 'vitest'
import { buildContexts } from '../../src/lib/context'
import {
    contextIdentity,
    fixedPaths,
    llmsTxt,
    sitemapPlan,
    urlsetXml,
} from '../../src/lib/discovery'
import type { SiteIdentity } from '../../src/lib/structured-data'

const family = buildContexts(
    {
        name: 'QueerOmaha',
        url: 'https://queeromaha.net',
        description: 'Queer Omaha, all in one place.',
    },
    [
        { id: 'net', host: 'queeromaha.net', canonical: true },
        {
            id: 'org',
            host: 'queeromaha.org',
            name: 'QueerOmaha Resources',
            description: 'Resources and mutual aid.',
        },
        { id: 'dev', host: 'queeromaha.dev', indexable: false },
    ],
)
const [net, org, dev] = family
const single = buildContexts(
    { name: 'Chantilly', url: 'https://example.com' },
    [],
)

describe('sitemapPlan', () => {
    const paths = fixedPaths(false)

    test('the canonical context keeps Emdash sitemap', () => {
        expect(sitemapPlan(net, 'https://queeromaha.net', paths)).toEqual({
            kind: 'emdash',
        })
        expect(sitemapPlan(single[0], 'https://example.com', paths)).toEqual({
            kind: 'emdash',
        })
    })

    test('another indexable context lists its own pages at its origin', () => {
        const plan = sitemapPlan(org, 'https://queeromaha.org', paths)
        expect(plan).toEqual({
            kind: 'fixed',
            urls: [
                'https://queeromaha.org/',
                'https://queeromaha.org/privacy',
                'https://queeromaha.org/terms',
                'https://queeromaha.org/accessibility',
            ],
        })
    })

    test('a non-indexable context has no sitemap', () => {
        expect(sitemapPlan(dev, 'https://queeromaha.dev', paths)).toEqual({
            kind: 'none',
        })
    })

    test('the contact page joins when the form is on', () => {
        expect(fixedPaths(true)).toContain('/contact')
        expect(fixedPaths(false)).not.toContain('/contact')
    })
})

describe('urlsetXml', () => {
    test('is a sitemap urlset with escaped locs', () => {
        const xml = urlsetXml(['https://example.org/a?b=1&c=2'])
        expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>\n/)
        expect(xml).toContain(
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        )
        expect(xml).toContain(
            '<url><loc>https://example.org/a?b=1&amp;c=2</loc></url>',
        )
    })
})

describe('llmsTxt', () => {
    test('names the context and links its own origin', () => {
        const body = llmsTxt({
            context: org,
            origin: 'https://queeromaha.org',
            contactEmail: 'hello@example.com',
        })
        expect(body).toMatch(
            /^# QueerOmaha Resources\n\n> Resources and mutual aid\./,
        )
        expect(body).toContain('](https://queeromaha.org/privacy)')
        expect(body).toContain('https://queeromaha.org/sitemap.xml')
        expect(body).not.toContain('queeromaha.net')
    })

    test('lists posts only on the canonical context', () => {
        const opts = { contactEmail: 'hello@example.com' }
        expect(
            llmsTxt({
                ...opts,
                context: net,
                origin: 'https://queeromaha.net',
            }),
        ).toContain('[Posts](https://queeromaha.net/posts)')
        expect(
            llmsTxt({
                ...opts,
                context: org,
                origin: 'https://queeromaha.org',
            }),
        ).not.toContain('/posts')
    })
})

describe('contextIdentity', () => {
    const site: SiteIdentity = {
        name: 'QueerOmaha',
        description: 'Queer Omaha, all in one place.',
        url: 'https://queeromaha.net',
        contactEmail: 'hello@example.com',
        business: {
            type: 'Organization',
            logo: '',
            telephone: '',
            address: {},
            areaServed: 'Omaha, NE',
            sameAs: ['https://github.com/queeromaha'],
            services: [],
        },
    }

    test('a single-context site is described as configured', () => {
        expect(contextIdentity(site, single[0], single)).toBe(site)
    })

    test('each context is its own organization at its own domain', () => {
        const id = contextIdentity(site, org, family)
        expect(id).toMatchObject({
            name: 'QueerOmaha Resources',
            description: 'Resources and mutual aid.',
            url: 'https://queeromaha.org',
        })
        expect(id.business.areaServed).toBe('Omaha, NE')
    })

    test('names the other indexable contexts in sameAs', () => {
        expect(contextIdentity(site, org, family).business.sameAs).toEqual([
            'https://github.com/queeromaha',
            'https://queeromaha.net/',
        ])
        expect(contextIdentity(site, dev, family).business.sameAs).toEqual([
            'https://github.com/queeromaha',
            'https://queeromaha.net/',
            'https://queeromaha.org/',
        ])
    })
})
