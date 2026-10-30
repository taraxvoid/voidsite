import type { NewsletterProvider } from '.'

// https://docs.buttondown.com/api-subscribers-create
const API = 'https://api.buttondown.com/v1/subscribers'

export const buttondown: NewsletterProvider = {
    name: 'Buttondown',
    privacyUrl: 'https://buttondown.com/legal/privacy',
    async subscribe(signup, apiKey, fetcher = fetch) {
        const res = await fetcher(API, {
            method: 'POST',
            headers: {
                Authorization: `Token ${apiKey}`,
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify({
                email_address: signup.email,
                // The visitor's address, not the Worker's, for Buttondown's
                // spam firewall.
                ip_address: signup.ip,
                // Unconfirmed until they click Buttondown's confirmation email.
                type: 'unactivated',
            }),
        })
        if (res.ok) return 'accepted'
        // 400 is an address already on the list (or one Buttondown's
        // firewall turned away). Answer as for a new one.
        if (res.status === 400) return 'accepted'
        console.error('buttondown signup failed', res.status)
        return 'failed'
    },
}
