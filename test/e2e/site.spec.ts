import { expect, type Page, test } from '@playwright/test'

// Every public page; add new ones as they are created.
const paths = ['/', '/privacy', '/terms', '/accessibility']

for (const path of paths) {
    test.describe(path, () => {
        test('loads with no console errors or failed requests', async ({
            page,
        }) => {
            const problems: string[] = []
            page.on('console', (m) => {
                if (m.type() === 'error') problems.push(`console: ${m.text()}`)
            })
            page.on('pageerror', (e) =>
                problems.push(`pageerror: ${e.message}`),
            )
            page.on('requestfailed', (r) => problems.push(`failed: ${r.url()}`))
            await page.route('https://www.googletagmanager.com/**', (route) =>
                route.fulfill({ status: 200, body: '' }),
            )
            await page.goto(path)
            await page.waitForLoadState('networkidle')
            expect(problems).toEqual([])
        })

        test('has page metadata: title, description, canonical, social, JSON-LD', async ({
            page,
            baseURL,
        }) => {
            await page.goto(path)
            await expect(page.locator('html')).toHaveAttribute(
                'lang',
                /^[a-z]{2}/,
            )
            await expect(page).toHaveTitle(/\S/)

            const attr = (selector: string, name: string) =>
                page.locator(selector).first().getAttribute(name)
            expect(await attr('meta[name="description"]', 'content')).toMatch(
                /\S/,
            )
            expect(await attr('meta[property="og:title"]', 'content')).toMatch(
                /\S/,
            )
            expect(await attr('meta[name="viewport"]', 'content')).toContain(
                'width=device-width',
            )

            if (path !== '/') {
                expect(await attr('link[rel="canonical"]', 'href')).toBe(
                    `${baseURL}${path}`,
                )
            }

            const ld = await page
                .locator('script[type="application/ld+json"]')
                .allTextContents()
            expect(ld.length).toBeGreaterThan(0)
            for (const block of ld) {
                expect(() => JSON.parse(block)).not.toThrow()
            }
        })

        test('external links that open a new tab are rel=noopener noreferrer', async ({
            page,
        }) => {
            await page.goto(path)
            const rels = await page
                .locator('a[target="_blank"]')
                .evaluateAll((els) =>
                    els.map((e) => e.getAttribute('rel') ?? ''),
                )
            for (const rel of rels) {
                expect(rel).toContain('noopener')
                expect(rel).toContain('noreferrer')
            }
        })

        test('has one h1, a skip link that works, and a main landmark', async ({
            page,
        }) => {
            await page.goto(path)
            // The home page shows emdash content, so only legal pages are
            // held to exactly one h1.
            if (path !== '/') {
                await expect(
                    page.getByRole('heading', { level: 1 }),
                ).toHaveCount(1)
            }
            await expect(page.getByRole('main')).toHaveCount(1)
            await page.keyboard.press('Tab')
            const skip = page.getByRole('link', { name: 'Skip to content' })
            await expect(skip).toBeFocused()
            await skip.press('Enter')
            await expect(page).toHaveURL(/#main$/)
        })
    })
}

async function overflowPx(page: Page) {
    return page.evaluate(
        () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
    )
}

test.describe('narrow screens', () => {
    test.use({ viewport: { width: 320, height: 640 } })

    for (const path of paths) {
        test(`${path} does not scroll sideways at 320px`, async ({ page }) => {
            await page.goto(path)
            expect(await overflowPx(page)).toBeLessThanOrEqual(0)
        })
    }
})
