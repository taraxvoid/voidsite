import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'

// The context switcher in the header lockup (W10, spec section 4.3). e2e
// builds serve two fixture contexts (src/lib/e2e-contexts.ts); localhost is
// a preview host, so `main` answers by default and the switcher links
// select a context with ?context=.

const switcher = (page: Page) => page.locator('[data-switcher]')
const summary = (page: Page) => switcher(page).locator('summary')
const header = (page: Page) => page.locator('[data-site-header]')

async function openTall(page: Page, path = '/') {
    await page.goto(path)
    await page.evaluate(() => {
        const main = document.querySelector('main')
        if (main) main.style.minBlockSize = '400vh'
    })
}

async function condense(page: Page) {
    await page.evaluate(() =>
        window.scrollTo({ top: 900, behavior: 'instant' }),
    )
    await expect(header(page)).toHaveAttribute('data-condensed', '')
}

test('names the current site and lists every context', async ({ page }) => {
    await page.goto('/')
    await expect(summary(page)).toHaveAccessibleName(
        'Switch site, current: example.com',
    )
    await expect(summary(page)).toHaveText('.com')
    await summary(page).click()
    const links = switcher(page).getByRole('link')
    await expect(links).toHaveCount(2)
    await expect(links.nth(0)).toHaveAttribute('href', '/?context=main')
    await expect(links.nth(0)).toHaveAttribute('aria-current', 'page')
    await expect(links.nth(1)).toHaveAttribute('href', '/?context=labs')
    await expect(links.nth(1)).not.toHaveAttribute('aria-current')
    await expect(links.nth(1)).toContainText('Side projects')
})

test('off its home, the current context is "true", not the page', async ({
    page,
}) => {
    await page.goto('/privacy')
    await summary(page).click()
    await expect(
        switcher(page).getByRole('link', { name: /example\.com/ }),
    ).toHaveAttribute('aria-current', 'true')
})

test('switching on a preview host selects the other context', async ({
    page,
}) => {
    await page.goto('/')
    await summary(page).click()
    await switcher(page)
        .getByRole('link', { name: /example\.org/ })
        .click()
    await expect(page).toHaveURL(/\?context=labs$/)
    await expect(summary(page)).toHaveAccessibleName(
        'Switch site, current: example.org',
    )
    // The preview cookie keeps it on the next page.
    await page.goto('/privacy')
    await expect(summary(page)).toHaveText('.org')
})

test('Escape closes it and returns focus to the summary', async ({ page }) => {
    await page.goto('/')
    await summary(page).focus()
    await page.keyboard.press('Enter')
    await expect(switcher(page)).toHaveAttribute('open', '')
    await page.keyboard.press('Tab')
    await expect(switcher(page).getByRole('link').first()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(switcher(page)).not.toHaveAttribute('open')
    await expect(summary(page)).toBeFocused()
})

test('a click outside closes it', async ({ page }) => {
    await page.goto('/')
    await summary(page).click()
    await expect(switcher(page)).toHaveAttribute('open', '')
    await page.locator('main').click({ position: { x: 5, y: 5 } })
    await expect(switcher(page)).not.toHaveAttribute('open')
})

test('opening it does not change the header height', async ({ page }) => {
    await page.goto('/')
    const bar = page.locator('.site-header-bar')
    const before = (await bar.boundingBox())?.height
    await summary(page).click()
    await expect(switcher(page).getByRole('link').first()).toBeVisible()
    expect((await bar.boundingBox())?.height).toBe(before)
})

test('summary and brand are at least 44px hit targets', async ({ page }) => {
    await page.goto('/?context=labs')
    for (const target of [summary(page), page.locator('[data-brand]')]) {
        const box = await target.boundingBox()
        expect(box?.width).toBeGreaterThanOrEqual(44)
        expect(box?.height).toBeGreaterThanOrEqual(44)
    }
})

test.describe('condensed, with a mark', () => {
    test.use({ reducedMotion: 'reduce' })

    test('keeps the mark and the chevron, and the label slides away', async ({
        page,
    }) => {
        await openTall(page, '/?context=labs')
        await condense(page)
        await expect(page.locator('.brand-mark')).toBeVisible()
        await expect(page.locator('.switcher-chevron')).toBeVisible()
        await expect(page.locator('.switcher-label')).toHaveCSS('opacity', '0')
        await expect(page.locator('.lockup-divider')).toHaveCSS('opacity', '0')
        const box = await summary(page).boundingBox()
        expect(box?.width).toBeGreaterThanOrEqual(44)
        expect(box?.height).toBeGreaterThanOrEqual(44)
    })

    test('opening the switcher keeps the header condensed', async ({
        page,
    }) => {
        await openTall(page, '/?context=labs')
        await condense(page)
        await summary(page).click()
        await expect(switcher(page).getByRole('link').first()).toBeVisible()
        await expect(header(page)).toHaveAttribute('data-condensed', '')
    })
})

for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${scheme} scheme`, () => {
        test.use({ colorScheme: scheme })

        for (const path of ['/', '/?context=labs']) {
            test(`open switcher on ${path} has no axe violations`, async ({
                page,
            }) => {
                await page.goto(path)
                await summary(page).click()
                await expect(
                    switcher(page).getByRole('link').first(),
                ).toBeVisible()
                const { violations } = await new AxeBuilder({ page })
                    .include('[data-site-header]')
                    .analyze()
                expect(violations.map((v) => v.id)).toEqual([])
            })
        }
    })
}

test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('the switcher opens and its links work', async ({ page }) => {
        await page.goto('/')
        await summary(page).click()
        const labs = switcher(page).getByRole('link', { name: /example\.org/ })
        await expect(labs).toBeVisible()
        await labs.click()
        await expect(summary(page)).toHaveText('.org')
    })
})
