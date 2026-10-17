/**
 * Cloudflare Turnstile server-side verification: the token must verify, for
 * the expected action, on one of this site's hostnames. Every failure,
 * including Cloudflare being unreachable, is a refusal.
 */

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const MAX_TOKEN = 2048

export interface VerifyOptions {
    secret: string | undefined
    token: unknown
    action: string
    /** Comma-separated, from the TURNSTILE_HOSTNAMES var. Empty refuses all. */
    hostnames: string | undefined
    remoteIp: string
}

export const hostnameSet = (value: string | undefined) =>
    new Set(
        (value ?? '')
            .split(',')
            .map((h) => h.trim())
            .filter(Boolean),
    )

interface SiteverifyResult {
    success?: boolean
    action?: string
    hostname?: string
    metadata?: { result_with_testing_key?: boolean }
}

export const verifyTurnstile = async (
    opts: VerifyOptions,
    fetcher: typeof fetch = fetch,
): Promise<boolean> => {
    const hostnames = hostnameSet(opts.hostnames)
    const { token, secret } = opts
    if (
        typeof token !== 'string' ||
        token.length === 0 ||
        token.length > MAX_TOKEN ||
        hostnames.size === 0 ||
        !secret
    ) {
        return false
    }
    let result: SiteverifyResult
    try {
        const res = await fetcher(SITEVERIFY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            signal: AbortSignal.timeout(10_000),
            body: new URLSearchParams({
                secret,
                response: token,
                remoteip: opts.remoteIp,
            }),
        })
        if (!res.ok) return false
        result = await res.json()
    } catch {
        return false
    }
    // Cloudflare's dummy secrets (local dev only) return no action.
    const testing = result.metadata?.result_with_testing_key === true
    return (
        result.success === true &&
        (testing || result.action === opts.action) &&
        typeof result.hostname === 'string' &&
        hostnames.has(result.hostname)
    )
}
