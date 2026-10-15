import { expect, type Page, test } from '@playwright/test'

// These need a build with a Google tag configured. `aube run test:e2e`
// builds with a fake id; a run against a deployed site skips them.
const GA_ID = process.env.PUBLIC_GA_MEASUREMENT_ID
test.skip(!GA_ID, 'needs a build with PUBLIC_GA_MEASUREMENT_ID')

// Stubs Google's script host and records every request made to it.
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
const button = (page: Page, name: string) =>
    page.getByRole('button', { name, exact: true })
const stored = (page: Page) =>
    page.evaluate(() => localStorage.getItem('consent'))

test('asks first, and sends nothing to Google before a choice', async ({
    page,
    context,
}) => {
    const requests = await trackGoogle(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(banner(page)).toBeVisible()
    expect(requests).toEqual([])
    expect(await context.cookies()).toEqual([])
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([])
})

test('accept loads the tag with consent mode, and is remembered', async ({
    page,
}) => {
    const requests = await trackGoogle(page)
    await page.goto('/')
    await button(page, 'Accept').click()

    await expect(banner(page)).toBeHidden()
    await expect
        .poll(() => requests.some((u) => u.includes(`gtag/js?id=${GA_ID}`)))
        .toBe(true)
    expect(await stored(page)).toBe('granted')

    const layer = await page.evaluate(() =>
        // biome-ignore lint/suspicious/noExplicitAny: test-only window access
        (window as any).dataLayer.map((a: ArrayLike<unknown>) => [
            ...Array.from(a),
        ]),
    )
    expect(layer).toContainEqual([
        'consent',
        'default',
        expect.objectContaining({ analytics_storage: 'denied' }),
    ])
    expect(layer).toContainEqual([
        'consent',
        'update',
        expect.objectContaining({
            analytics_storage: 'granted',
            ad_storage: 'denied',
            ad_user_data: 'denied',
            ad_personalization: 'denied',
        }),
    ])

    requests.length = 0
    await page.reload()
    await expect(banner(page)).toBeHidden()
    await expect
        .poll(() => requests.some((u) => u.includes('gtag/js')))
        .toBe(true)
})

test('decline sends nothing and is remembered', async ({ page }) => {
    const requests = await trackGoogle(page)
    await page.goto('/')
    await button(page, 'Decline').click()

    await expect(banner(page)).toBeHidden()
    expect(await stored(page)).toBe('denied')

    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(banner(page)).toBeHidden()
    expect(requests).toEqual([])
})

test('Global Privacy Control is a decline: no banner, no Google, even after a past accept', async ({
    page,
}) => {
    const requests = await trackGoogle(page)
    await page.addInitScript(() => {
        Object.defineProperty(navigator, 'globalPrivacyControl', {
            value: true,
        })
        localStorage.setItem('consent', 'granted')
    })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(banner(page)).toBeHidden()
    await expect(button(page, 'Cookie settings')).toBeHidden()
    expect(requests).toEqual([])
})

test('cookie settings reopens the banner, and declining clears Google cookies', async ({
    page,
    context,
    baseURL,
}) => {
    await trackGoogle(page)
    await page.goto('/')
    await button(page, 'Accept').click()
    await context.addCookies([
        { name: '_ga', value: 'GA1.1.1.1', url: baseURL as string },
        { name: '_ga_E2ETEST123', value: 'x', url: baseURL as string },
        { name: 'keep_me', value: 'y', url: baseURL as string },
    ])

    await button(page, 'Cookie settings').click()
    await expect(banner(page)).toBeVisible()
    await expect(button(page, 'Accept')).toBeFocused()

    await button(page, 'Decline').click()
    await expect(banner(page)).toBeHidden()
    expect(await stored(page)).toBe('denied')
    const names = (await context.cookies()).map((c) => c.name)
    expect(names).toEqual(['keep_me'])
})

test('both choices work from the keyboard', async ({ page }) => {
    await trackGoogle(page)
    await page.goto('/')
    await button(page, 'Decline').focus()
    await page.keyboard.press('Enter')
    expect(await stored(page)).toBe('denied')
})
