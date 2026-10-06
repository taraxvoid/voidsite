import { expect, test } from '@playwright/test'
import { AI_ANSWER_BOTS } from '../../src/lib/robots'

// Dogfoods rvnflt's agent-legibility audit (isAgentLegible in
// ravenflight/rvnflt packages/schemas/src/audit.ts): AI search crawlers can
// reach the site, pages read without JavaScript, and nothing opts out of
// AI answers. Its fourth criterion, JSON-LD that describes the business
// (LocalBusiness and friends), isn't built yet, so it isn't asserted here.
// Nor is the home page's text: with no content it is a "No posts yet" list,
// which an agent can't learn the business from. Both arrive with the
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
