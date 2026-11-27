import { expect, test } from '@playwright/test'

// Analytics and privacy copy per context (W10, spec section 4.4). e2e
// builds have a Google tag (PUBLIC_GA_MEASUREMENT_ID) and three fixture
// contexts (src/lib/e2e-contexts.ts); `labs` turns Google off. localhost is
// a preview host, so `?context=<id>` picks one. Request fixture only.

const hasGoogle = Boolean(
    process.env.PUBLIC_GA_MEASUREMENT_ID || process.env.PUBLIC_GTM_ID,
)

const text = (html: string) =>
    html
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')

test.describe('a context with Google off', () => {
    test.beforeEach(async ({ request }) => {
        expect((await request.get('/?context=labs')).ok()).toBe(true)
    })

    test('pages carry no consent banner and no cookie settings', async ({
        request,
    }) => {
        // Bundled scripts name these selectors and the tag URL; with no
        // banner in the markup they find nothing and load nothing.
        const markup = (await (await request.get('/')).text()).replace(
            /<script[\s\S]*?<\/script>/g,
            '',
        )
        expect(markup).not.toContain('data-consent-banner')
        expect(markup).not.toContain('data-consent-reopen')
        expect(markup).not.toContain('googletagmanager.com')
    })

    test('its privacy page describes no Google cookies', async ({
        request,
    }) => {
        const body = text(await (await request.get('/privacy')).text())
        expect(body).toContain('we set no cookies')
        expect(body).not.toContain('_ga')
        expect(body).not.toContain('"consent"')
        expect(body).toContain('The rest of this section describes example.org')
    })
})

test('the privacy page lists what runs on each site', async ({ request }) => {
    const html = await (await request.get('/privacy?context=main')).text()
    const list = html.match(/<ul data-analytics-per-site[\s\S]*?<\/ul>/)?.[0]
    expect(list).toBeTruthy()
    const items = text(list ?? '')
    expect(items).toContain(
        hasGoogle
            ? 'example.com: Google Analytics, only if you accept'
            : 'example.com: no analytics',
    )
    expect(items).toMatch(/example\.org: (no analytics|PostHog, cookieless)/)
    expect(items).toContain('example.net:')
})

test('the canonical context keeps the Google wording', async ({ request }) => {
    test.skip(!hasGoogle, 'no Google tag in this build')
    const html = await (await request.get('/privacy?context=main')).text()
    expect(text(html)).toContain('_ga')
    expect(html).toContain('data-consent-banner')
})
