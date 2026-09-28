import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Add every public page here as it is created.
const paths = ['/']

// Deliberately wcag2a/aa + 2.2 AA rules only; the accessibility page claims
// no conformance level, but these are the ones this template commits to.
const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

for (const scheme of ['light', 'dark'] as const) {
    test.describe(`${scheme} scheme`, () => {
        test.use({ colorScheme: scheme })

        for (const path of paths) {
            test(`${path} has no axe violations`, async ({ page }) => {
                await page.goto(path)
                const { violations } = await new AxeBuilder({ page })
                    .withTags(tags)
                    .analyze()
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
