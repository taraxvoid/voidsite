/**
 * The anti-abuse flow shared by the contact and newsletter routes: honeypot,
 * per-visitor rate limit, Turnstile (action and hostname checked), then
 * delivery. The routes keep what differs (parsing, delivery, the enabled
 * flag); this takes bindings as arguments so it is unit-tested without
 * cloudflare:workers.
 *
 * The rate limit is a KV read followed by a write, so two simultaneous
 * requests from one visitor can both pass. That is accepted: a strictly
 * atomic claim needs a Durable Object, which is too heavy for a form that
 * Turnstile already guards. The cost is at most a duplicate message.
 */
import { RATE_LIMIT_TTL_SECONDS, rateLimitKey } from './contact'
import { verifyTurnstile } from './turnstile'

export interface GuardEnv {
    RATE_LIMIT: {
        get(key: string): Promise<string | null>
        put(
            key: string,
            value: string,
            options: { expirationTtl: number },
        ): Promise<void>
        delete(key: string): Promise<void>
    }
    TURNSTILE_SECRET?: string
    TURNSTILE_HOSTNAMES?: string
}

export type Parsed<T> =
    | { kind: 'ok'; data: T }
    | { kind: 'bot' }
    | { kind: 'invalid' }

export interface GuardedForm<T> {
    /** Turnstile action and rate-limit scope. */
    action: 'contact' | 'newsletter'
    site: string
    parse: (form: FormData) => Parsed<T>
    /** Resolves true when delivered; false (or a throw) is a failure. */
    deliver: (data: T) => Promise<boolean>
    /** Skip delivery and log instead; the slot is still claimed. */
    dryRun: boolean
    /** Error code returned when delivery fails. */
    failureCode: string
}

export const failure = (status: number, error: string) =>
    Response.json({ ok: false, error }, { status })

export async function handleGuardedForm<T>(
    request: Request,
    clientAddress: string,
    env: GuardEnv,
    form: GuardedForm<T>,
): Promise<Response> {
    let body: FormData
    try {
        body = await request.formData()
    } catch {
        return failure(400, 'invalid')
    }

    const parsed = form.parse(body)
    // Pretend success so bots don't learn the honeypot exists.
    if (parsed.kind === 'bot') return Response.json({ ok: true })
    if (parsed.kind === 'invalid') return failure(400, 'invalid')

    const limitKey = await rateLimitKey(form.site, clientAddress, form.action)
    if (await env.RATE_LIMIT.get(limitKey)) return failure(429, 'rate_limited')

    const human = await verifyTurnstile({
        secret: env.TURNSTILE_SECRET,
        token: body.get('cf-turnstile-response'),
        action: form.action,
        hostnames: env.TURNSTILE_HOSTNAMES,
        remoteIp: clientAddress,
    })
    if (!human) return failure(403, 'forbidden')

    // Claim the slot before delivering to narrow the window for duplicate
    // submissions; release it if delivery fails so the visitor can retry.
    await env.RATE_LIMIT.put(limitKey, '1', {
        expirationTtl: RATE_LIMIT_TTL_SECONDS,
    })

    if (form.dryRun) {
        console.log(`${form.action} dry run`, parsed.data)
        return Response.json({ ok: true })
    }

    let delivered = false
    try {
        delivered = await form.deliver(parsed.data)
    } catch (error) {
        console.error(`${form.action} delivery failed`, error)
    }
    if (!delivered) {
        await env.RATE_LIMIT.delete(limitKey)
        return failure(502, form.failureCode)
    }
    return Response.json({ ok: true })
}
