import { expect, test } from '@playwright/test'
import { AI_ANSWER_BOTS } from '../../src/lib/robots'

// Dogfoods rvnflt's agent-legibility audit (isAgentLegible in
// ravenflight/rvnflt packages/schemas/src/audit.ts): AI search crawlers can
// reach the site, pages read without JavaScript, and nothing opts out of
// AI answers, and every page carries JSON-LD describing the business
// (src/lib/structured-data.ts, from siteConfig.business). The home page's
// text isn't asserted: with no content it is a "No posts yet" list, which
// an agent can't learn the business from; that arrives with the
// local-service content model.

// Every public page; add new ones as they are created.
const paths = ['/', '/privacy', '/terms', '/accessibility']

// rvnflt's JS_ONLY_TEXT_LENGTH_THRESHOLD.
const MIN_TEXT_WITHOUT_JS = 200

test('robots.txt lets every AI answer crawler in', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.ok()).toBe(true)
    const body = await res.text()
    expect(body).toMatch(/User-agent: \*\n(?:.*\n)*?Allow: \/\n/)
    for (const bot of AI_ANSWER_BOTS) {
        expect(body).not.toContain(`User-agent: ${bot}`)
    }
})

for (const path of paths) {
    test(`${path} is not opted out of AI answers`, async ({ request }) => {
        const res = await request.get(path)
        expect(res.ok()).toBe(true)
        expect(res.headers()['x-robots-tag'] ?? '').not.toMatch(
            /noindex|nosnippet|none/i,
        )
        const html = await res.text()
        const metas = html.match(/<meta[^>]+name=["']robots["'][^>]*>/gi) ?? []
        for (const meta of metas) {
            expect(meta).not.toMatch(/noindex|nosnippet|none/i)
        }
    })
}

test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    for (const path of paths.filter((p) => p !== '/')) {
        test(`${path} has readable text for agents`, async ({ page }) => {
            await page.goto(path)
            const text = await page.locator('body').innerText()
            expect(text.trim().length).toBeGreaterThan(MIN_TEXT_WITHOUT_JS)
        })
    }
})

for (const path of paths) {
    test(`${path} describes the business in JSON-LD`, async ({ request }) => {
        const html = await (await request.get(path)).text()
        const blocks = [
            ...html.matchAll(
                /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
            ),
        ].map((m) => JSON.parse(m[1] as string))
        const business = blocks.find((b) => b['@id']?.endsWith('/#business'))
        expect(business?.['@context']).toBe('https://schema.org')
        expect(business?.name).toBeTruthy()
        expect(business?.url).toBeTruthy()
    })
}
