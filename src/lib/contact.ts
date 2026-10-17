/**
 * Contact form validation and email shape. Pure, so it is unit-tested; the
 * route (src/pages/api/contact.ts) adds Turnstile, rate limiting and delivery.
 */

export const RATE_LIMIT_TTL_SECONDS = 3600

// Keep in sync with the maxlength attributes in ContactForm.astro.
export const MAX_MESSAGE = 2000
export const MAX_NAME = 120
export const MAX_EMAIL = 254
// Deliberately loose: one @, no whitespace. Delivery is the real validation.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+$/

export type ContactInput = { message: string; email: string; name?: string }

export type ParsedContact =
    | { kind: 'ok'; data: ContactInput }
    | { kind: 'bot' }
    | { kind: 'invalid' }

const field = (form: FormData, key: string) => {
    const value = form.get(key)
    return typeof value === 'string' ? value.trim() : ''
}

export function parseContact(form: FormData): ParsedContact {
    // Real visitors never see the honeypot; anything in it is a bot.
    if (field(form, 'website') !== '') return { kind: 'bot' }

    const message = field(form, 'message')
    const email = field(form, 'email')
    const name = field(form, 'name')
    if (!message || message.length > MAX_MESSAGE) return { kind: 'invalid' }
    if (!email || email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email))
        return { kind: 'invalid' }
    if (name.length > MAX_NAME || /[\r\n]/.test(name))
        return { kind: 'invalid' }
    return {
        kind: 'ok',
        data: name ? { message, email, name } : { message, email },
    }
}

/**
 * KV key for the per-visitor limit. The IP is hashed (salted with the site,
 * so keys don't match across sites) and the entry expires after an hour, so
 * the store never holds a raw address.
 */
export async function rateLimitKey(site: string, ip: string): Promise<string> {
    const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`${site} contact ${ip}`),
    )
    const hex = [...new Uint8Array(digest)]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
    return `contact:${hex}`
}

export function buildEmail(
    input: ContactInput,
    site: string,
    from: string,
    to: string,
) {
    return {
        from,
        to: [to],
        reply_to: input.email,
        subject: input.name
            ? `${site} contact from ${input.name}`
            : `${site} contact`,
        text: `${input.message}\n\n— ${input.name ? `${input.name} ` : ''}<${input.email}>`,
    }
}
