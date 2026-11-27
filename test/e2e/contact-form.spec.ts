import { expect, test } from '@playwright/test'

// The fixture page exists only in builds with PUBLIC_E2E_FIXTURES=1
// (build:e2e). The form needs JavaScript (Turnstile), so it must stay hidden
// until its script runs; without JavaScript the page's email address is the
// way to get in touch.
const FIXTURE = '/e2e/contact-form'

test.describe('with JavaScript', () => {
    test('appears once the script initializes', async ({ page }) => {
        // Stand in for Turnstile so the form doesn't call Cloudflare.
        await page.route('https://challenges.cloudflare.com/**', (route) =>
            route.fulfill({
                contentType: 'text/javascript',
                body: 'window.turnstile = { render: () => "w", reset() {} }',
            }),
        )
        await page.goto(FIXTURE)
        await expect(page.locator('form#contact')).toBeVisible()
        await expect(page.getByLabel('Message', { exact: true })).toBeVisible()
    })
})

test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('stays hidden', async ({ page }) => {
        await page.goto(FIXTURE)
        await expect(page.locator('form#contact')).toBeHidden()
        await expect(page.getByRole('button', { name: 'Send' })).toBeHidden()
    })
})
