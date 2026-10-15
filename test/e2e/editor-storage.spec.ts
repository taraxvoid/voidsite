import { expect, type Locator, test } from '@playwright/test'

// The admin is a React app: a click that lands before hydration is dropped.
// Retry the whole step until the next screen appears.
async function advance(step: () => Promise<void>, next: Locator) {
    await expect(async () => {
        await step()
        await expect(next).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 90_000 })
}

// Opt-in: `aube run test:e2e:editor`. Completes Emdash's setup wizard on a
// fresh local D1 with a virtual passkey, signs in, and checks the cookies and
// localStorage keys against what the privacy page tells editors and visitors.
// The wizard only runs once per database, so the script wipes .wrangler/state.
test.skip(!process.env.EDITOR_E2E, 'run with `aube run test:e2e:editor`')

test('editor sign-in sets exactly what the privacy page lists; visitors get nothing', async ({
    page,
    context,
    browser,
}) => {
    test.setTimeout(240_000)

    const cdp = await context.newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
        options: {
            protocol: 'ctap2',
            transport: 'internal',
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true,
            automaticPresenceSimulation: true,
        },
    })

    // Set up the site, register a passkey, then sign in with it.
    const button = (name: string | RegExp) => page.getByRole('button', { name })
    await page.goto('/_emdash/admin/setup')
    await page.waitForLoadState('networkidle')
    await advance(async () => {
        const text = page.locator('input[type=text]')
        await text.nth(0).fill('Chantilly Test')
        await text.nth(1).fill('test site')
        await button(/Continue/).click({ timeout: 5_000 })
    }, page.locator('input[type=email]'))
    // The wizard's labels aren't tied to their inputs, so select by type.
    await advance(async () => {
        await page.locator('input[type=email]').fill('editor@example.com')
        await page.locator('input[type=text]').fill('Test Editor')
        await button(/Continue/).click({ timeout: 5_000 })
    }, button('Create passkey'))
    await advance(
        () => button('Create passkey').click({ timeout: 5_000 }),
        button(/Open the dashboard/),
    )
    await advance(
        () => button(/Open the dashboard/).click({ timeout: 5_000 }),
        button(/passkey/i).first(),
    )
    await button(/passkey/i)
        .first()
        .click()
    await page.waitForURL(/\/_emdash\/admin(?!\/login)/)

    // Let the admin and the editing toolbar write whatever they will.
    await page.waitForLoadState('networkidle')
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const cookies = (await context.cookies()).map((c) => c.name).sort()
    const keys = (await page.evaluate(() => Object.keys(localStorage))).sort()
    expect(cookies).toEqual(['__em_d1_bookmark', 'astro-session'])
    expect(keys).toEqual(['emdash-editor', 'emdash-toolbar-labels'])

    // Everything observed is documented on the privacy page.
    await page.goto('/privacy')
    const privacy = await page.locator('main').innerText()
    for (const name of [...cookies, ...keys]) expect(privacy).toContain(name)
    // Session cookies, HttpOnly, as the page says.
    for (const c of await context.cookies()) {
        expect(c.expires).toBe(-1)
        expect(c.httpOnly).toBe(true)
    }

    // A visitor to the now set-up site gets no cookies and no storage.
    const visitor = await browser.newContext()
    const vpage = await visitor.newPage()
    for (const path of ['/', '/posts', '/privacy']) {
        await vpage.goto(new URL(path, page.url()).href)
        await vpage.waitForLoadState('networkidle')
    }
    expect(await visitor.cookies()).toEqual([])
    expect(await vpage.evaluate(() => Object.keys(localStorage))).toEqual([])
    await visitor.close()
})
