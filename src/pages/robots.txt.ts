import type { APIRoute } from 'astro'
import { contextOrigin } from '../lib/context'
import { buildRobots } from '../lib/robots'
import { siteConfig } from '../site.config'

// Overrides the bare-bones robots.txt that emdash serves. Per context: its
// own Sitemap line, and Disallow: / when the context is not indexable.
export const GET: APIRoute = ({ url, locals }) =>
    new Response(
        buildRobots({
            origin: contextOrigin(url, locals.context, locals.production),
            aiTraining: siteConfig.crawlers.aiTraining,
            indexable: locals.context.indexable,
        }),
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
