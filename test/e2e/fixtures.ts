import { test as base } from '@playwright/test'
import { paths } from './paths'

const TURNSTILE_API =
    'https://challenges.cloudflare.com/turnstile/v0/api.js'

// Stands in for Turnstile's api.js. Tests run against a production build, so
// the real widget would get the production site key, which rejects
// localhost, and its iframe logs CSP noise that changes with each Cloudflare
// release. Like the real widget on success, render() adds the
// cf-turnstile-response field and reports the token.
const TURNSTILE_STUB = `window.turnstile = {
    render(container, options) {
        const el = typeof container === 'string'
            ? document.querySelector(container)
            : container
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = 'cf-turnstile-response'
        input.value = 'test-turnstile-token'
        el.appendChild(input)
        options.callback?.(input.value)
        return 'test-widget-id'
    },
    reset() {},
}`

// Pages get the stub served as the real script, so the form's loader runs
// as in production. Any other request to Cloudflare's challenge host (the
// widget iframe) is aborted, which the console checks report as a failure.
export const test = base.extend({
    page: async ({ page }, use) => {
        await page.route('https://challenges.cloudflare.com/**', (route) =>
            route.request().url().startsWith(TURNSTILE_API)
                ? route.fulfill({
                      contentType: 'text/javascript',
                      body: TURNSTILE_STUB,
                  })
                : route.abort(),
        )
        await use(page)
    },
})

export { expect } from '@playwright/test'
export { paths }
