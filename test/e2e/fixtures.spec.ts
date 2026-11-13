import { expect, test } from './fixtures'

// The shared fixture stands in for Cloudflare's Turnstile on every spec that
// imports `test` from it. These pin what it promises.

test('serves api.js as the stub: render adds the response field and calls back', async ({
    page,
}) => {
    await page.goto('/')
    const result = await page.evaluate(async () => {
        await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src =
                'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('blocked'))
            document.head.appendChild(script)
        })
        const container = document.createElement('div')
        document.body.appendChild(container)
        let token = ''
        const turnstile = (
            window as unknown as {
                turnstile: {
                    render: (
                        el: HTMLElement,
                        o: { callback: (t: string) => void },
                    ) => string
                }
            }
        ).turnstile
        const id = turnstile.render(container, {
            callback: (t) => {
                token = t
            },
        })
        const input = container.querySelector<HTMLInputElement>(
            'input[name="cf-turnstile-response"]',
        )
        return { id, token, field: input?.value, type: input?.type }
    })
    expect(result).toEqual({
        id: 'test-widget-id',
        token: 'test-turnstile-token',
        field: 'test-turnstile-token',
        type: 'hidden',
    })
})

test('aborts any other request to the challenge host', async ({ page }) => {
    await page.goto('/')
    const outcome = await page.evaluate(() =>
        fetch(
            'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/x',
            {
                mode: 'no-cors',
            },
        ).then(
            () => 'fulfilled',
            () => 'aborted',
        ),
    )
    expect(outcome).toBe('aborted')
})
