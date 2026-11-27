import type { APIRoute } from 'astro'
import { contextOrigin } from '../lib/context'
import { llmsTxt } from '../lib/discovery'
import { siteConfig } from '../site.config'

// https://llmstxt.org, per context (src/lib/discovery.ts). A context that
// keeps out of search has none.
export const GET: APIRoute = ({ url, locals }) => {
    if (!locals.context.indexable) return new Response(null, { status: 404 })
    const body = llmsTxt({
        context: locals.context,
        origin: contextOrigin(url, locals.context, locals.production),
        contactEmail: siteConfig.contactEmail,
    })
    return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
}
