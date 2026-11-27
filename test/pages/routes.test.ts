import type { APIContext } from 'astro'
import { describe, expect, test } from 'vitest'
import { buildContexts } from '../../src/lib/context'
import { GET as llms } from '../../src/pages/llms.txt'
import { GET as robots } from '../../src/pages/robots.txt'

// Call the route handlers directly, like queeromaha's page tests: fast, and
// no server needed. Only `url` and the context the middleware puts on
// `locals` are read.
const contexts = buildContexts(
    { name: 'Chantilly', url: 'https://example.com' },
    [
        { id: 'main', host: 'example.com', canonical: true },
        { id: 'labs', host: 'example.org', name: 'Labs' },
        { id: 'quiet', host: 'example.net', indexable: false },
    ],
)
const ctx = (origin: string, id = 'main', production = false) =>
    ({
        url: new URL('/', origin),
        locals: {
            context: contexts.find((c) => c.id === id),
            contexts,
            production,
        },
    }) as unknown as APIContext

describe('GET /robots.txt', () => {
    test('sets plain text content type', async () => {
        const res = await robots(ctx('https://example.com'))
        expect(res.headers.get('Content-Type')).toBe(
            'text/plain; charset=utf-8',
        )
    })

    test('uses the request origin for the sitemap, so previews are right', async () => {
        const body = await (
            await robots(ctx('https://pr-1.example.workers.dev'))
        ).text()
        expect(body).toContain(
            'Sitemap: https://pr-1.example.workers.dev/sitemap.xml',
        )
    })

    test('refuses AI training by default and allows search and AI answers', async () => {
        const body = await (await robots(ctx('https://example.com'))).text()
        expect(body).toContain(
            'Content-Signal: ai-train=no, search=yes, ai-input=yes',
        )
        expect(body).toContain('User-agent: GPTBot\nDisallow: /')
    })
})

describe('GET /llms.txt', () => {
    test('sets plain text content type', async () => {
        const res = await llms(ctx('https://example.com'))
        expect(res.headers.get('Content-Type')).toBe(
            'text/plain; charset=utf-8',
        )
    })

    test('has the site title, absolute page links and a sitemap', async () => {
        const body = await (await llms(ctx('https://example.com'))).text()
        expect(body).toMatch(/^# .+/)
        expect(body).toContain('](https://example.com/privacy)')
        expect(body).toContain('https://example.com/sitemap.xml')
    })
})

describe('per context', () => {
    test('robots.txt names the context sitemap on its own host', async () => {
        const body = await (
            await robots(ctx('https://example.org', 'labs', true))
        ).text()
        expect(body).toContain('Sitemap: https://example.org/sitemap.xml')
    })

    test('a non-indexable context has no llms.txt and no sitemap line', async () => {
        const quiet = ctx('https://example.net', 'quiet', true)
        expect((await llms(quiet)).status).toBe(404)
        expect(await (await robots(quiet)).text()).not.toContain('Sitemap:')
    })

    test('llms.txt is named after the context', async () => {
        const body = await (
            await llms(ctx('https://example.org', 'labs', true))
        ).text()
        expect(body).toMatch(/^# Labs\n/)
    })
})
