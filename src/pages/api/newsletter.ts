import { env } from 'cloudflare:workers'
import type { APIRoute } from 'astro'
import { RATE_LIMIT_TTL_SECONDS, rateLimitKey } from '../../lib/contact'
import {
    parseSignup,
    providers,
    type SignupOutcome,
} from '../../lib/newsletter'
import { verifyTurnstile } from '../../lib/turnstile'
import { siteConfig } from '../../site.config'

// Honeypot, Turnstile (action and hostname checked), one signup per visitor
// per hour, then the configured provider. 404 unless
// siteConfig.newsletter.enabled.
export const prerender = false

const ACTION = 'newsletter'

const failure = (status: number, error: string) =>
    Response.json({ ok: false, error }, { status })

export const POST: APIRoute = async ({ request, clientAddress }) => {
    if (!siteConfig.newsletter.enabled) return failure(404, 'not_found')

    let form: FormData
    try {
        form = await request.formData()
    } catch {
        return failure(400, 'invalid')
    }

    const parsed = parseSignup(form)
    // Pretend success so bots don't learn the honeypot exists.
    if (parsed.kind === 'bot') return Response.json({ ok: true })
    if (parsed.kind === 'invalid') return failure(400, 'invalid')

    const limitKey = await rateLimitKey(siteConfig.url, clientAddress, ACTION)
    if (await env.RATE_LIMIT.get(limitKey)) return failure(429, 'rate_limited')

    const human = await verifyTurnstile({
        secret: env.TURNSTILE_SECRET,
        token: form.get('cf-turnstile-response'),
        action: ACTION,
        hostnames: env.TURNSTILE_HOSTNAMES,
        remoteIp: clientAddress,
    })
    if (!human) return failure(403, 'forbidden')

    // Claim the slot before calling the provider so concurrent signups can't
    // both pass; release it if the provider fails so the visitor can retry.
    await env.RATE_LIMIT.put(limitKey, '1', {
        expirationTtl: RATE_LIMIT_TTL_SECONDS,
    })

    const signup = { email: parsed.email, ip: clientAddress }
    if (env.CONTACT_DRY_RUN === '1') {
        console.log('newsletter dry run', signup)
        return Response.json({ ok: true })
    }

    const provider = providers[siteConfig.newsletter.provider]
    let outcome: SignupOutcome
    try {
        if (!env.NEWSLETTER_API_KEY) throw new Error('NEWSLETTER_API_KEY unset')
        outcome = await provider.subscribe(signup, env.NEWSLETTER_API_KEY)
    } catch (error) {
        console.error('newsletter signup failed', error)
        outcome = 'failed'
    }
    if (outcome === 'failed') {
        await env.RATE_LIMIT.delete(limitKey)
        return failure(502, 'signup_failed')
    }

    return Response.json({ ok: true })
}
