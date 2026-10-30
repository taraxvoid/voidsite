/**
 * Browser side of Turnstile for the contact and newsletter forms. Loaded only
 * on pages with a form, and only with JavaScript on.
 */

export type TurnstileApi = {
    render: (
        container: HTMLElement,
        options: {
            sitekey: string
            action: string
            appearance?: 'always' | 'execute' | 'interaction-only'
        },
    ) => string
    reset: (widgetId: string) => void
}

const TURNSTILE_SRC =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

const w = () => window as Window & { turnstile?: TurnstileApi }

export const loadTurnstile = () =>
    new Promise<TurnstileApi>((resolve, reject) => {
        const loaded = w().turnstile
        if (loaded) return resolve(loaded)
        const script = document.createElement('script')
        script.src = TURNSTILE_SRC
        script.async = true
        script.addEventListener('load', () => {
            const api = w().turnstile
            if (api) resolve(api)
            else reject(new Error('turnstile unavailable'))
        })
        script.addEventListener('error', () =>
            reject(new Error('turnstile failed to load')),
        )
        document.head.appendChild(script)
    })

/** Turnstile tokens are single-use: reset after every submission. */
export const resetTurnstile = (widgetId: string | undefined) => {
    if (widgetId !== undefined) w().turnstile?.reset(widgetId)
}

/** Cloudflare's always-pass test key in dev; the production key rejects localhost. */
export const turnstileSiteKey = (configured: string, dev: boolean) =>
    dev ? '1x00000000000000000000AA' : configured
