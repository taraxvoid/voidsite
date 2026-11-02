import { env } from 'cloudflare:workers'
import type { APIRoute } from 'astro'
import { buildEmail, parseContact } from '../../lib/contact'
import { failure, handleGuardedForm } from '../../lib/form-guard'
import { siteConfig } from '../../site.config'

// Honeypot, Turnstile (action and hostname checked), one message per visitor
// per hour, delivery via Cloudflare Email Sending (the EMAIL binding). 404
// unless siteConfig.contact.enabled. The flow is in lib/form-guard.ts.
export const prerender = false

export const POST: APIRoute = async ({ request, clientAddress }) => {
    if (!siteConfig.contact.enabled) return failure(404, 'not_found')

    return handleGuardedForm(request, clientAddress, env, {
        action: 'contact',
        site: siteConfig.url,
        parse: parseContact,
        dryRun: env.CONTACT_DRY_RUN === '1',
        failureCode: 'delivery_failed',
        deliver: async (data) => {
            await env.EMAIL.send(
                buildEmail(
                    data,
                    siteConfig.name,
                    siteConfig.mailFrom,
                    siteConfig.contactEmail,
                ),
            )
            return true
        },
    })
}
