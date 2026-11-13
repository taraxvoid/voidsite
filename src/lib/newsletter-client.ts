/**
 * Browser side of the newsletter signup forms. A page can hold several
 * (the /subscribe page, CTA blocks); each submits and reports on its own.
 */
import { loadTurnstile, resetTurnstile } from './turnstile-client'

const initForm = (form: HTMLFormElement) => {
    const container = form.querySelector<HTMLElement>('[data-turnstile]')
    const status = form.querySelector<HTMLElement>('[role="status"]')
    if (!container || !status) return
    form.dataset.ready = ''

    // The form needs JavaScript (Turnstile), so it starts hidden; the
    // provider's own page, when configured, is the no-JS path. A CTA with
    // no such page is hidden as a whole until now.
    form.hidden = false
    form.closest<HTMLElement>('[data-newsletter-cta]')?.removeAttribute(
        'hidden',
    )
    const button = form.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
    )
    let widgetId: string | undefined

    const show = (text: string) => {
        status.textContent = text
        status.hidden = false
    }

    loadTurnstile()
        .then((turnstile) => {
            widgetId = turnstile.render(container, {
                sitekey: container.dataset.sitekey as string,
                action: 'newsletter',
                appearance: 'interaction-only',
            })
        })
        .catch(() => {
            show('The bot check could not load. Reload the page to try again.')
        })

    form.addEventListener('submit', async (event) => {
        event.preventDefault()
        if (button) button.disabled = true
        status.hidden = true
        try {
            const res = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
            })
            if (res.status === 429) {
                show('One signup per hour, please. Try again later.')
                return
            }
            if (!res.ok) throw new Error(String(res.status))
            form.reset()
            show(
                "Thanks. Unless you're already subscribed, a confirmation email is on its way; you're subscribed once you confirm it.",
            )
        } catch {
            show('Something went wrong. Try again in a moment.')
        } finally {
            resetTurnstile(widgetId)
            if (button) button.disabled = false
        }
    })
}

export const initNewsletterForms = (root: ParentNode = document) => {
    for (const form of root.querySelectorAll<HTMLFormElement>(
        'form[data-newsletter]:not([data-ready])',
    )) {
        initForm(form)
    }
}
