import { expect, test } from '@playwright/test'
import { siteConfig } from '../../src/site.config'

const pages = [
    { path: '/privacy', heading: 'Privacy' },
    { path: '/terms', heading: 'Terms' },
    { path: '/accessibility', heading: 'Accessibility' },
]

for (const { path, heading } of pages) {
    test(`${path} renders with its heading, date and version`, async ({
        page,
    }) => {
        const response = await page.goto(path)
        expect(response?.status()).toBe(200)
        await expect(
            page.getByRole('heading', { level: 1, name: heading }),
        ).toBeVisible()
        await expect(
            page.getByText(/Last updated \d{4}-\d{2}-\d{2}/),
        ).toBeVisible()
        await expect(
            page.getByText(/Site version .+ built \d{4}-/),
        ).toBeVisible()
    })
}

test('the footer links to every enabled legal page', async ({ page }) => {
    await page.goto('/')
    const legal = page.getByRole('navigation', { name: 'Legal' })
    for (const name of ['Privacy', 'Terms', 'Accessibility']) {
        await expect(legal.getByRole('link', { name })).toBeVisible()
    }
    await expect(
        legal.getByRole('link', { name: 'Sub-processors' }),
    ).toHaveCount(0)
    await expect(legal.getByRole('link', { name: /Do not sell/ })).toHaveCount(
        0,
    )
})

const optional = [
    { path: '/sub-processors', enabled: siteConfig.legal.subProcessorsPage },
    { path: '/do-not-sell', enabled: siteConfig.legal.doNotSellPage },
    { path: '/contact', enabled: siteConfig.contact.enabled },
]

test('optional pages exist exactly when site.config enables them', async ({
    request,
}) => {
    for (const { path, enabled } of optional) {
        expect((await request.get(path)).status()).toBe(enabled ? 200 : 404)
    }
})

test('the contact endpoint is off unless the form is enabled', async ({
    request,
}) => {
    test.skip(siteConfig.contact.enabled, 'contact form enabled')
    const res = await request.post('/api/contact', {
        form: { message: 'hi', email: 'a@b.co' },
    })
    expect(res.status()).toBe(404)
})

test('privacy copy mentions the contact form exactly when it is on', async ({
    page,
}) => {
    await page.goto('/privacy')
    const text = await page.locator('main').innerText()
    if (siteConfig.contact.enabled) {
        expect(text).toContain('Turnstile')
        expect(text).toContain('Resend')
    } else {
        expect(text).not.toContain('Turnstile')
        expect(text).not.toContain('Resend')
    }
})

test('the accessibility page claims no conformance level', async ({ page }) => {
    await page.goto('/accessibility')
    const text = await page.locator('main').innerText()
    expect(text).toMatch(/WCAG 2\.2/)
    expect(text).not.toMatch(/conforms? (to|with)|Level A{1,3}\b|compliant/i)
})

test('the privacy page describes the storage the site really uses', async ({
    page,
}) => {
    await page.goto('/privacy')
    const text = await page.locator('main').innerText()
    // Always: the theme key and the editor cookies and keys (checked against a
    // real sign-in by editor-storage.spec.ts).
    for (const item of [
        'theme',
        'astro-session',
        '__em_d1_bookmark',
        'emdash_oauth_csrf',
        'emdash-editor',
        'emdash-toolbar-labels',
    ]) {
        expect(text).toContain(item)
    }
    // Google wording appears exactly when the build has a Google tag.
    const hasGoogle = Boolean(
        process.env.PUBLIC_GA_MEASUREMENT_ID || process.env.PUBLIC_GTM_ID,
    )
    if (hasGoogle) {
        for (const item of ['_ga', 'consent', 'Cookie settings']) {
            expect(text).toContain(item)
        }
    }
})

test('robots.txt is ours rather than the emdash default, and names the real sitemap', async ({
    request,
}) => {
    const body = await (await request.get('/robots.txt')).text()
    expect(body).toContain('Content-Signal: ai-train=no')
    expect(body).toContain('Disallow: /_emdash/')
    expect(body).toMatch(/Sitemap: http.*\/sitemap\.xml/)
    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.status()).toBe(200)
})

test('llms.txt describes the site', async ({ request }) => {
    const response = await request.get('/llms.txt')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toMatch(/^# .+/)
    expect(body).toContain('/privacy')
})
