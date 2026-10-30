import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'
import { siteConfig } from '../../src/site.config'

// The fixture page exists only in builds with PUBLIC_E2E_FIXTURES=1
// (build:e2e). It renders three CTAs: #first (defaults), #second (custom
// copy) and #linked (with a provider page for the no-JS path).
const FIXTURE = '/e2e/newsletter-cta'

// Stand in for Turnstile so the forms don't call Cloudflare.
const stubTurnstile = async (page: Page) => {
    const requests: string[] = []
    await page.route('https://challenges.cloudflare.com/**', (route) => {
        requests.push(route.request().url())
        return route.fulfill({
            contentType: 'text/javascript',
            body: 'window.turnstile = { render: () => String(Math.random()), reset() {} }',
        })
    })
    return requests
}

const cta = (page: Page, id: string) =>
    page.locator(`[data-newsletter-cta]:has(#${id}-heading)`)

test.describe('with JavaScript', () => {
    let turnstileRequests: string[]

    test.beforeEach(async ({ page }) => {
        turnstileRequests = await stubTurnstile(page)
    })

    test('renders defaults with an h2 and a labelled field', async ({
        page,
    }) => {
        await page.goto(FIXTURE)
        const heading = page.locator('#first-heading')
        await expect(heading).toHaveText('Get new posts by email')
        expect(await heading.evaluate((el) => el.tagName)).toBe('H2')
        await expect(
            cta(page, 'first').getByText(
                'One email when something new goes up. Unsubscribe any time.',
            ),
        ).toBeVisible()
        // Only the three fixture CTAs: #pt-sample adds one when enabled.
        await expect(
            page.locator('#first, #second, #linked').getByLabel('Your email'),
        ).toHaveCount(3)
        await expect(
            page.locator('#first').getByRole('button', { name: 'Subscribe' }),
        ).toBeVisible()
    })

    test('the field and button share a row', async ({ page }) => {
        await page.goto(FIXTURE)
        const field = await page.locator('#first-email').boundingBox()
        const button = await page
            .locator('#first')
            .getByRole('button')
            .boundingBox()
        if (!field || !button) throw new Error('CTA not laid out')
        const middle = (box: { y: number; height: number }) =>
            box.y + box.height / 2
        expect(Math.abs(middle(field) - middle(button))).toBeLessThan(4)
    })

    test('two CTAs submit and report independently', async ({ page }) => {
        let calls = 0
        await page.route('**/api/newsletter', (route) => {
            calls += 1
            return route.fulfill({ status: calls === 1 ? 200 : 429 })
        })
        await page.goto(FIXTURE)

        await page.locator('#first-email').fill('one@example.com')
        await page.locator('#first').getByRole('button').click()
        await expect(page.locator('#first-status')).toContainText(
            'a confirmation email is on its way',
        )
        await expect(page.locator('#second-status')).toBeHidden()

        await page.locator('#second-email').fill('two@example.com')
        await page
            .locator('#second')
            .getByRole('button', { name: 'Join' })
            .click()
        await expect(page.locator('#second-status')).toContainText(
            'One signup per hour',
        )
        await expect(page.locator('#first-status')).toContainText(
            'a confirmation email is on its way',
        )
        expect(turnstileRequests).toHaveLength(1)
    })

    for (const scheme of ['light', 'dark'] as const) {
        test(`axe passes in the ${scheme} scheme`, async ({ page }) => {
            await page.emulateMedia({ colorScheme: scheme })
            await page.goto(FIXTURE)
            await expect(page.locator('#first')).toBeVisible()
            const { violations } = await new AxeBuilder({ page }).analyze()
            expect(
                violations.flatMap((v) =>
                    v.nodes.map((n) => `${v.id} @ ${n.target.join(' ')}`),
                ),
            ).toEqual([])
        })
    }
})

test.describe('without JavaScript', () => {
    test.use({ javaScriptEnabled: false })

    test('only the linked CTA shows, as a link', async ({ page }) => {
        await page.goto(FIXTURE)
        await expect(cta(page, 'first')).toBeHidden()
        await expect(cta(page, 'second')).toBeHidden()
        await expect(
            cta(page, 'linked').locator(
                'a[href="https://example.com/newsletter"]',
            ),
        ).toBeVisible()
        await expect(page.locator('form[data-newsletter]:visible')).toHaveCount(
            0,
        )
    })
})

// #pt-sample renders a saved editor block through <PortableText>, so it
// follows siteConfig.newsletter.enabled like a real page would.
test.describe('a saved editor block', () => {
    test('renders nothing while the newsletter is off', async ({ page }) => {
        test.skip(siteConfig.newsletter.enabled, 'newsletter enabled')
        await page.goto(FIXTURE)
        const sample = page.locator('#pt-sample')
        await expect(sample.getByText('Before the block.')).toBeVisible()
        await expect(sample.locator('[data-newsletter-cta]')).toHaveCount(0)
        // Rendered by the plugin (as nothing), not as an unknown type.
        await expect(sample.locator('[data-portabletext-unknown]')).toHaveCount(
            0,
        )
    })

    test('renders the CTA while the newsletter is on', async ({ page }) => {
        test.skip(!siteConfig.newsletter.enabled, 'newsletter disabled')
        await page.goto(FIXTURE)
        await expect(page.locator('#pt-sample h2')).toHaveText(
            'From the editor',
        )
    })
})
