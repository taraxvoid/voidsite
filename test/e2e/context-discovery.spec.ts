import { expect, test } from '@playwright/test'
import { AI_ANSWER_BOTS } from '../../src/lib/robots'
import { paths } from './paths'

// Discovery files and head metadata per context (W10, spec section 4.4).
// e2e builds serve three fixture contexts (src/lib/e2e-contexts.ts):
// `main` (canonical), `labs` (indexable) and `quiet` (not indexable).
// localhost is a preview host, so `?context=<id>` picks one and the session
// cookie keeps it for the rest of the test's requests. Only the request
// fixture is used: no browser needed.

const jsonLd = (html: string) =>
    [
        ...html.matchAll(
            /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
        ),
    ].map((m) => JSON.parse(m[1] as string))

const robotsMetas = (html: string) =>
    html.match(/<meta[^>]+name=["']robots["'][^>]*>/gi) ?? []

test.describe('an indexable, non-canonical context', () => {
    test.beforeEach(async ({ request }) => {
        expect((await request.get('/?context=labs')).ok()).toBe(true)
    })

    test('robots.txt keeps AI answers in and names its sitemap', async ({
        request,
    }) => {
        const body = await (await request.get('/robots.txt')).text()
        expect(body).toContain('search=yes, ai-input=yes')
        expect(body).toMatch(/Sitemap: http:\/\/localhost:\d+\/sitemap\.xml/)
        for (const bot of AI_ANSWER_BOTS) {
            expect(body).not.toContain(`User-agent: ${bot}`)
        }
    })

    test('its sitemap lists its own pages at its origin', async ({
        request,
        baseURL,
    }) => {
        const res = await request.get('/sitemap.xml')
        expect(res.status()).toBe(200)
        const xml = await res.text()
        expect(xml).toContain('<urlset')
        expect(xml).toContain(`<loc>${baseURL}/privacy</loc>`)
        expect((await request.get('/sitemap-posts.xml')).status()).toBe(404)
    })

    test('llms.txt is named after the context', async ({ request }) => {
        const body = await (await request.get('/llms.txt')).text()
        expect(body).toMatch(/^# .+/)
        expect(body).not.toContain('/posts')
    })

    for (const path of paths) {
        test(`${path} is indexable and describes this context`, async ({
            request,
        }) => {
            const res = await request.get(path)
            expect(res.headers()['x-robots-tag'] ?? '').toBe('')
            const html = await res.text()
            expect(robotsMetas(html)).toEqual([])
            const business = jsonLd(html).find((b) =>
                b['@id']?.endsWith('/#business'),
            )
            expect(business?.url).toBe('https://example.org')
            expect(business?.sameAs).toContain('https://example.com/')
            expect(business?.sameAs).not.toContain('https://example.net/')
            expect(html).toContain('property="og:site_name"')
        })
    }
})

test.describe('a context kept out of search', () => {
    test.beforeEach(async ({ request }) => {
        expect((await request.get('/?context=quiet')).ok()).toBe(true)
    })

    for (const path of paths) {
        test(`${path} says noindex in a header and a meta`, async ({
            request,
        }) => {
            const res = await request.get(path)
            expect(res.headers()['x-robots-tag']).toBe('noindex')
            expect(robotsMetas(await res.text()).join()).toContain('noindex')
        })
    }

    test('has no sitemap or llms.txt, and robots.txt still allows fetching', async ({
        request,
    }) => {
        expect((await request.get('/sitemap.xml')).status()).toBe(404)
        expect((await request.get('/llms.txt')).status()).toBe(404)
        const robots = await request.get('/robots.txt')
        expect(robots.headers()['x-robots-tag']).toBe('noindex')
        const body = await robots.text()
        expect(body).toContain('search=no, ai-input=no')
        expect(body).toMatch(/User-agent: \*\n(?:.*\n)*?Allow: \/\n/)
        expect(body).not.toContain('Sitemap:')
    })
})

test('the canonical context keeps Emdash sitemap index', async ({
    request,
}) => {
    const res = await request.get('/sitemap.xml?context=main')
    expect(res.status()).toBe(200)
    expect(await res.text()).toContain('<sitemapindex')
})
