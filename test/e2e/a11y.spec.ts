import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Add every public page here as it is created.
const paths = ['/', '/privacy', '/terms', '/accessibility']

// Full default rule set (WCAG A/AA plus best practices), like queeromaha.

for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${scheme} scheme`, () => {
        test.use({ colorScheme: scheme })

        for (const path of paths) {
            test(`${path} has no axe violations`, async ({ page }) => {
                await page.goto(path)
                const { violations } = await new AxeBuilder({ page }).analyze()
                expect(
                    violations.flatMap((v) =>
                        v.nodes.map(
                            (n) =>
                                `${v.id} @ ${n.target.join(' ')}: ${n.any[0]?.message ?? v.help}`,
                        ),
                    ),
                ).toEqual([])
            })
        }
    })
}

test.describe('interactive states', () => {
    test.use({ colorScheme: 'light' })

    test('an explicit dark choice on a light browser has no violations', async ({
        page,
    }) => {
        await page.goto('/privacy')
        await page.getByRole('radio', { name: 'Dark', exact: true }).check()
        const { violations } = await new AxeBuilder({ page }).analyze()
        expect(violations.map((v) => v.id)).toEqual([])
    })

    test('the reopened consent banner has no violations', async ({ page }) => {
        test.skip(
            !process.env.PUBLIC_GA_MEASUREMENT_ID,
            'needs a Google tag build',
        )
        await page.goto('/')
        await page.getByRole('button', { name: 'Decline', exact: true }).click()
        await page.getByRole('button', { name: 'Cookie settings' }).click()
        await expect(
            page.getByRole('region', { name: 'Analytics cookies' }),
        ).toBeVisible()
        const { violations } = await new AxeBuilder({ page }).analyze()
        expect(violations.map((v) => v.id)).toEqual([])
    })
})
