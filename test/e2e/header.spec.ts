import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

// The condensing header (src/components/SiteHeader.astro). Pages in the seed
// can be short, so each test makes the page tall enough to scroll first.

const header = (page: Page) => page.locator('[data-site-header]')
const brand = (page: Page) => page.locator('[data-brand]')

async function openTall(page: Page, path = '/') {
    await page.goto(path)
    await page.evaluate(() => {
        const main = document.querySelector('main')
        if (main) main.style.minBlockSize = '400vh'
    })
}

async function scrollTo(page: Page, y: number) {
    await page.evaluate(
        (top) => window.scrollTo({ top, behavior: 'instant' }),
        y,
    )
}

// Where the main content starts in the document, independent of scrolling.
const mainTop = (page: Page) =>
    page.evaluate(
        () =>
            (document.querySelector('main')?.getBoundingClientRect().top ?? 0) +
            window.scrollY,
    )

test('starts full size and condenses on scroll down', async ({ page }) => {
    await openTall(page)
    await expect(header(page)).not.toHaveAttribute('data-condensed')
    const full = await page.locator('.site-header-bar').boundingBox()

    await scrollTo(page, 600)
    await expect(header(page)).toHaveAttribute('data-condensed', '')
    // Wait out the transition before measuring.
    await expect
        .poll(
            async () =>
                (await page.locator('.site-header-bar').boundingBox())?.height,
        )
        .toBeLessThan(full?.height ?? 0)
})

test('expands again as soon as the visitor scrolls up', async ({ page }) => {
    await openTall(page)
    await scrollTo(page, 900)
    await expect(header(page)).toHaveAttribute('data-condensed', '')
    await scrollTo(page, 700)
    await expect(header(page)).not.toHaveAttribute('data-condensed')
})

test('stays pinned to the top and keeps links and buttons', async ({
    page,
}) => {
    await openTall(page)
    await scrollTo(page, 900)
    await expect(header(page)).toHaveAttribute('data-condensed', '')

    const bar = await page.locator('.site-header-bar').boundingBox()
    expect(bar?.y).toBe(0)
    await expect(page.getByRole('group', { name: 'Color theme' })).toBeVisible()
    await expect(brand(page)).toBeVisible()
    for (const link of await page
        .getByRole('navigation', { name: 'Main' })
        .getByRole('link')
        .all()) {
        await expect(link).toBeVisible()
    }
})

test('condensing never moves the page content', async ({ page }) => {
    await openTall(page)
    const before = await mainTop(page)
    await scrollTo(page, 900)
    await expect(header(page)).toHaveAttribute('data-condensed', '')
    await page.waitForTimeout(400)
    expect(await mainTop(page)).toBe(before)

    await scrollTo(page, 600)
    await expect(header(page)).not.toHaveAttribute('data-condensed')
    await page.waitForTimeout(400)
    expect(await mainTop(page)).toBe(before)
})

test('full size, the logo links home', async ({ page }) => {
    await openTall(page)
    await expect(brand(page)).toHaveAttribute('href', '/')
    await expect(brand(page)).not.toHaveAttribute('aria-label')
})

test.describe('condensed, the logo goes back to the top', () => {
    test.describe('reduced motion', () => {
        test.use({ reducedMotion: 'reduce' })

        test('jumps straight there, without navigating', async ({ page }) => {
            await openTall(page, '/privacy')
            await scrollTo(page, 900)
            await expect(brand(page)).toHaveAccessibleName('Back to top')
            await brand(page).click()
            // Instant: no waiting for an animation.
            expect(await page.evaluate(() => window.scrollY)).toBe(0)
            expect(new URL(page.url()).pathname).toBe('/privacy')
            await expect(header(page)).not.toHaveAttribute('data-condensed')
        })
    })

    test.describe('no preference', () => {
        test.use({ reducedMotion: 'no-preference' })

        test('glides there, without navigating', async ({ page }) => {
            await openTall(page, '/privacy')
            await scrollTo(page, 2000)
            await expect(header(page)).toHaveAttribute('data-condensed', '')
            await brand(page).click()
            await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
            expect(new URL(page.url()).pathname).toBe('/privacy')
        })
    })

    test('works from the keyboard', async ({ page }) => {
        await openTall(page, '/privacy')
        await scrollTo(page, 900)
        await expect(header(page)).toHaveAttribute('data-condensed', '')
        await brand(page).focus()
        await page.keyboard.press('Enter')
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
        expect(new URL(page.url()).pathname).toBe('/privacy')
    })
})

test.describe('motion preferences', () => {
    const navTransition = (page: Page) =>
        page
            .locator('.site-header-bar nav')
            .evaluate((el) => getComputedStyle(el).transitionDuration)

    test.describe('reduced', () => {
        test.use({ reducedMotion: 'reduce' })

        test('the header changes size without animating', async ({ page }) => {
            await page.goto('/')
            expect(await navTransition(page)).toBe('0s')
        })
    })

    test.describe('no preference', () => {
        test.use({ reducedMotion: 'no-preference' })

        // Guards the test above: it must be able to fail.
        test('the header animates', async ({ page }) => {
            await page.goto('/')
            expect(await navTransition(page)).toBe('0.2s')
        })
    })
})

for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${scheme} scheme`, () => {
        test.use({ colorScheme: scheme })

        test('condensed header has no axe violations', async ({ page }) => {
            await openTall(page)
            await scrollTo(page, 900)
            await expect(header(page)).toHaveAttribute('data-condensed', '')
            await page.waitForTimeout(400)
            const { violations } = await new AxeBuilder({ page })
                .include('[data-site-header]')
                .analyze()
            expect(violations.map((v) => v.id)).toEqual([])
        })
    })
}

test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('the header still sticks and the logo links home', async ({
        page,
    }) => {
        await page.goto('/')
        await expect(
            header(page).evaluate((el) => getComputedStyle(el).position),
        ).resolves.toBe('sticky')
        await expect(brand(page)).toHaveAttribute('href', '/')
    })
})

test('focusing a header control while condensed does not scroll the page', async ({
    page,
}) => {
    await openTall(page)
    await scrollTo(page, 900)
    await expect(header(page)).toHaveAttribute('data-condensed', '')
    await brand(page).focus()
    await page.getByRole('radio', { name: 'Dark', exact: true }).focus()
    expect(await page.evaluate(() => window.scrollY)).toBe(900)
    await expect(header(page)).toHaveAttribute('data-condensed', '')
})

test('a focused element in the page is not left under the bar', async ({
    page,
}) => {
    await openTall(page)
    await page.evaluate(() => {
        const link = document.createElement('a')
        link.href = '#'
        link.textContent = 'Deep link'
        link.style.cssText = 'position:absolute;top:1200px'
        document.querySelector('main')?.append(link)
    })
    // Leave the link right at the top edge of the viewport, behind the bar.
    const top = await page
        .getByRole('link', { name: 'Deep link' })
        .evaluate((el) => el.getBoundingClientRect().top + window.scrollY)
    await scrollTo(page, top - 5)
    await expect(header(page)).toHaveAttribute('data-condensed', '')
    await page.getByRole('link', { name: 'Deep link' }).focus()

    const bar = await page.locator('.site-header-bar').boundingBox()
    const link = await page
        .getByRole('link', { name: 'Deep link' })
        .boundingBox()
    expect(link?.y ?? 0).toBeGreaterThanOrEqual(
        (bar?.y ?? 0) + (bar?.height ?? 0) - 1,
    )
})

// The template ships without a mark (site.config.ts header.mark), so add the
// same markup SiteHeader renders for one.
test.describe('with a brand mark', () => {
    test.use({ reducedMotion: 'reduce' })

    test('condensed, the wordmark slides away and the mark stays', async ({
        page,
    }) => {
        await openTall(page)
        await page.evaluate(() => {
            const header = document.querySelector('[data-site-header]')
            header?.toggleAttribute('data-has-mark', true)
            const mark = document.createElement('img')
            mark.className = 'brand-mark'
            mark.alt = ''
            mark.src =
                'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'
            document.querySelector('[data-brand]')?.prepend(mark)
        })
        const wordmark = page.locator('.brand-wordmark')
        expect((await wordmark.boundingBox())?.width).toBeGreaterThan(10)

        await scrollTo(page, 900)
        await expect(header(page)).toHaveAttribute('data-condensed', '')
        await expect(page.locator('.brand-mark')).toBeVisible()
        await expect
            .poll(async () => (await wordmark.boundingBox())?.width ?? 0)
            .toBeLessThan(1)

        await scrollTo(page, 600)
        await expect
            .poll(async () => (await wordmark.boundingBox())?.width ?? 0)
            .toBeGreaterThan(10)
    })
})

// The template ships without a wordmark (site.config.ts header.wordmark), so
// swap in the markup SiteHeader renders for one: inlineWordmark's output.
async function addWordmark(page: Page) {
    await page.evaluate(() => {
        const inner = document.querySelector('.brand-wordmark-inner')
        if (!inner) return
        const svg = new DOMParser().parseFromString(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20" class="brand-logo brand-logo-svg" role="img" aria-label="Wordmark">' +
                '<path data-test="plain" d="M0 0h60v20H0z"/>' +
                '<path data-test="own" fill="rgb(222, 153, 23)" d="M70 0h30v20H70z"/>' +
                '</svg>',
            'image/svg+xml',
        ).documentElement
        inner.replaceChildren(svg)
    })
}

const fillOf = (page: Page, which: string) =>
    page
        .locator(`.brand-logo-svg [data-test="${which}"]`)
        .evaluate((el) => getComputedStyle(el).fill)

const headerColor = (page: Page) =>
    page.locator('[data-brand]').evaluate((el) => getComputedStyle(el).color)

test.describe('with an SVG wordmark', () => {
    test.use({ reducedMotion: 'reduce' })

    for (const scheme of ['light', 'dark'] as const) {
        test.describe(`${scheme} scheme`, () => {
            test.use({ colorScheme: scheme })

            test('unfilled paths take the header text color', async ({
                page,
            }) => {
                await openTall(page)
                await addWordmark(page)
                expect(await fillOf(page, 'plain')).toBe(
                    await headerColor(page),
                )
                // Paths with a fill of their own (an accent) keep it.
                expect(await fillOf(page, 'own')).toBe('rgb(222, 153, 23)')
            })

            test('has no axe violations', async ({ page }) => {
                await openTall(page)
                await addWordmark(page)
                const { violations } = await new AxeBuilder({ page })
                    .include('[data-site-header]')
                    .analyze()
                expect(violations.map((v) => v.id)).toEqual([])
            })
        })
    }

    test('follows the theme toggle, not just the browser', async ({ page }) => {
        await openTall(page)
        await addWordmark(page)
        await page.getByRole('radio', { name: 'Light', exact: true }).check()
        const light = await fillOf(page, 'plain')
        await page.getByRole('radio', { name: 'Dark', exact: true }).check()
        const dark = await fillOf(page, 'plain')
        expect(dark).not.toBe(light)
        expect(dark).toBe(await headerColor(page))
    })

    test('--brand-wordmark overrides the color', async ({ page }) => {
        await openTall(page)
        await addWordmark(page)
        await page.evaluate(() =>
            document.documentElement.style.setProperty(
                '--brand-wordmark',
                'rgb(100, 95, 95)',
            ),
        )
        expect(await fillOf(page, 'plain')).toBe('rgb(100, 95, 95)')
    })

    test('names the home link and shrinks when condensed', async ({ page }) => {
        await openTall(page)
        await addWordmark(page)
        await expect(brand(page)).toHaveAccessibleName('Wordmark')
        const svg = page.locator('.brand-logo-svg')
        const full = (await svg.boundingBox())?.height ?? 0
        expect(full).toBeGreaterThan(20)

        await scrollTo(page, 900)
        await expect(header(page)).toHaveAttribute('data-condensed', '')
        await expect
            .poll(async () => (await svg.boundingBox())?.height ?? 0)
            .toBeLessThan(full)
    })
})
