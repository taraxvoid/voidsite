import type { APIContext } from 'astro'
import { describe, expect, test } from 'vitest'
import { GET as llms } from '../../src/pages/llms.txt'
import { GET as robots } from '../../src/pages/robots.txt'

// Call the route handlers directly, like queeromaha's page tests: fast, and
// no server needed. Only `url` is read.
const ctx = (origin: string) =>
    ({ url: new URL('/', origin) }) as unknown as APIContext

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
