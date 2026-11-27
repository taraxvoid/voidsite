import { env } from 'cloudflare:workers'
import type { APIRoute } from 'astro'
import { failure, handleGuardedForm } from '../../lib/form-guard'
import { parseSignup, providers } from '../../lib/newsletter'
import { siteConfig } from '../../site.config'

// Honeypot, Turnstile (action and hostname checked), one signup per visitor
// per hour, then the configured provider. 404 unless
// siteConfig.newsletter.enabled. The flow is in lib/form-guard.ts.
export const prerender = false

export const POST: APIRoute = async ({ request, clientAddress }) => {
    if (!siteConfig.newsletter.enabled) return failure(404, 'not_found')

    return handleGuardedForm(request, clientAddress, env, {
        action: 'newsletter',
        site: siteConfig.url,
        parse: (form) => {
            const parsed = parseSignup(form)
            return parsed.kind === 'ok'
                ? { kind: 'ok', data: { email: parsed.email } }
                : parsed
        },
        dryRun: env.CONTACT_DRY_RUN === '1',
        failureCode: 'signup_failed',
        deliver: async ({ email }) => {
            if (!env.NEWSLETTER_API_KEY) {
                throw new Error('NEWSLETTER_API_KEY unset')
            }
            const outcome = await providers[
                siteConfig.newsletter.provider
            ].subscribe({ email, ip: clientAddress }, env.NEWSLETTER_API_KEY)
            return outcome !== 'failed'
        },
    })
}
