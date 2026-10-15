import { expect, type Page, test } from '@playwright/test'

// Needs a build with only PUBLIC_GTM_ID set: `aube run test:e2e:gtm`.
const GTM_ID = process.env.PUBLIC_GTM_ID
test.skip(!GTM_ID, 'needs a build with PUBLIC_GTM_ID')

async function trackGoogle(page: Page) {
    const requests: string[] = []
    await page.route('https://www.googletagmanager.com/**', (route) => {
        requests.push(route.request().url())
        return route.fulfill({
            status: 200,
            contentType: 'application/javascript',
            body: '',
        })
    })
    return requests
}

const banner = (page: Page) =>
    page.getByRole('region', { name: 'Analytics cookies' })

test('sends nothing to Google before a choice', async ({ page }) => {
    const requests = await trackGoogle(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(banner(page)).toBeVisible()
    expect(requests).toEqual([])
})

test('accept loads the container (not gtag.js) with consent mode', async ({
    page,
}) => {
    const requests = await trackGoogle(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Accept', exact: true }).click()

    await expect
        .poll(() => requests.some((u) => u.includes(`gtm.js?id=${GTM_ID}`)))
        .toBe(true)
    expect(requests.some((u) => u.includes('gtag/js'))).toBe(false)

    const layer = await page.evaluate(() =>
        // biome-ignore lint/suspicious/noExplicitAny: test-only window access
        (window as any).dataLayer.map((a: ArrayLike<unknown>) =>
            Array.isArray(a) ? a : { ...a },
        ),
    )
    expect(JSON.stringify(layer)).toContain('"gtm.start"')
    expect(JSON.stringify(layer)).toContain('"event":"gtm.js"')
    expect(JSON.stringify(layer)).toContain('"analytics_storage":"granted"')
    expect(JSON.stringify(layer)).toContain('"ad_storage":"denied"')
})

test('decline sends nothing', async ({ page }) => {
    const requests = await trackGoogle(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Decline', exact: true }).click()
    await page.reload()
    await page.waitForLoadState('networkidle')
    expect(requests).toEqual([])
})

test('the privacy page says Tag Manager is used', async ({ page }) => {
    await page.goto('/privacy')
    const text = await page.locator('main').innerText()
    expect(text).toContain('through Google Tag Manager')
    expect(text).toContain('further cookies')
})
