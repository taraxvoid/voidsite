import { env } from 'cloudflare:workers'
import type { APIRoute } from 'astro'
import {
    buildEmail,
    parseContact,
    RATE_LIMIT_TTL_SECONDS,
    rateLimitKey,
} from '../../lib/contact'
import { verifyTurnstile } from '../../lib/turnstile'
import { siteConfig } from '../../site.config'

// Honeypot, Turnstile (action and hostname checked), one message per visitor
// per hour, delivery via Resend. 404 unless siteConfig.contact.enabled.
export const prerender = false

const ACTION = 'contact'

const failure = (status: number, error: string) =>
    Response.json({ ok: false, error }, { status })

export const POST: APIRoute = async ({ request, clientAddress }) => {
    if (!siteConfig.contact.enabled) return failure(404, 'not_found')

    let form: FormData
    try {
        form = await request.formData()
    } catch {
        return failure(400, 'invalid')
    }

    const parsed = parseContact(form)
    // Pretend success so bots don't learn the honeypot exists.
    if (parsed.kind === 'bot') return Response.json({ ok: true })
    if (parsed.kind === 'invalid') return failure(400, 'invalid')

    const limitKey = await rateLimitKey(siteConfig.url, clientAddress)
    if (await env.RATE_LIMIT.get(limitKey)) return failure(429, 'rate_limited')

    const human = await verifyTurnstile({
        secret: env.TURNSTILE_SECRET,
        token: form.get('cf-turnstile-response'),
        action: ACTION,
        hostnames: env.TURNSTILE_HOSTNAMES,
        remoteIp: clientAddress,
    })
    if (!human) return failure(403, 'forbidden')

    // Claim the slot before sending so concurrent submissions can't both
    // pass; release it if delivery fails so the sender can retry.
    await env.RATE_LIMIT.put(limitKey, '1', {
        expirationTtl: RATE_LIMIT_TTL_SECONDS,
    })

    const email = buildEmail(
        parsed.data,
        siteConfig.name,
        env.CONTACT_FROM,
        env.CONTACT_TO,
    )
    if (env.CONTACT_DRY_RUN === '1') {
        console.log('contact dry run', email)
        return Response.json({ ok: true })
    }

    try {
        const send = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${env.RESEND_API_KEY}`,
                'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10_000),
            body: JSON.stringify(email),
        })
        if (!send.ok) throw new Error(`resend ${send.status}`)
    } catch (error) {
        console.error('contact delivery failed', error)
        await env.RATE_LIMIT.delete(limitKey)
        return failure(502, 'delivery_failed')
    }

    return Response.json({ ok: true })
}
