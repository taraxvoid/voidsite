/**
 * Newsletter signup behind a small provider adapter. The visitor posts to our
 * own /api/newsletter; the Worker calls the provider with a secret, so the
 * browser never talks to the provider. The provider owns the list: double
 * opt-in, unsubscribes, bounces and sending.
 *
 * To add a provider, write a NewsletterProvider next to buttondown.ts and add
 * it to `providers`.
 */
import { isEmail } from '../contact'
import { buttondown } from './buttondown'

export type Signup = { email: string; ip: string }

/**
 * `accepted` covers addresses already on the list too, so the form can't be
 * used to find out who subscribes.
 */
export type SignupOutcome = 'accepted' | 'failed'

export interface NewsletterProvider {
    /** Named on the privacy and sub-processor pages. */
    name: string
    privacyUrl: string
    /** Throws only if the provider can't be reached. */
    subscribe(
        signup: Signup,
        apiKey: string,
        fetcher?: typeof fetch,
    ): Promise<SignupOutcome>
}

export const providers = { buttondown } satisfies Record<
    string,
    NewsletterProvider
>

export type NewsletterProviderId = keyof typeof providers

export type ParsedSignup =
    | { kind: 'ok'; email: string }
    | { kind: 'bot' }
    | { kind: 'invalid' }

export function parseSignup(form: FormData): ParsedSignup {
    const field = (key: string) => {
        const value = form.get(key)
        return typeof value === 'string' ? value.trim() : ''
    }
    // Real visitors never see the honeypot; anything in it is a bot.
    if (field('website') !== '') return { kind: 'bot' }
    const email = field('email')
    return isEmail(email) ? { kind: 'ok', email } : { kind: 'invalid' }
}
