import type { APIRoute } from 'astro'
import { buildRobots } from '../lib/robots'
import { siteConfig } from '../site.config'

// Overrides the bare-bones robots.txt that emdash serves.
export const GET: APIRoute = ({ url }) =>
    new Response(
        buildRobots({
            origin: url.origin,
            aiTraining: siteConfig.crawlers.aiTraining,
        }),
        { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
