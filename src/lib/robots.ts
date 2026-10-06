/**
 * robots.txt. Emdash serves a bare-bones one (allow all, block /_emdash/);
 * src/pages/robots.txt.ts replaces it with this so the site can state its AI
 * policy. Search and AI-answer use stay allowed; training is refused unless
 * siteConfig.crawlers.aiTraining is true.
 */

// Crawlers that collect content specifically to train models.
export const AI_TRAINING_BOTS = [
    'GPTBot',
    'ClaudeBot',
    'Google-Extended',
    'Applebot-Extended',
    'Amazonbot',
    'Meta-ExternalAgent',
    'CCBot',
    'Bytespider',
] as const

// Crawlers that feed AI search answers or fetch a page when a person asks an
// assistant about it. Never named in robots.txt, so they fall under the
// wildcard Allow; blocking one hides the site from that assistant.
export const AI_ANSWER_BOTS = [
    'OAI-SearchBot',
    'ChatGPT-User',
    'Claude-SearchBot',
    'Claude-User',
    'PerplexityBot',
    'Perplexity-User',
    'DuckAssistBot',
    'Meta-ExternalFetcher',
] as const

export function buildRobots({
    origin,
    aiTraining,
}: {
    origin: string
    aiTraining: boolean
}): string {
    const signal = `ai-train=${aiTraining ? 'yes' : 'no'}, search=yes, ai-input=yes`
    const lines = [
        '# Content signals (https://contentsignals.org): search and AI answers',
        '# are welcome; training use follows the ai-train value below. Any',
        '# restriction is an express reservation of rights under Article 4 of',
        '# EU Directive 2019/790.',
        'User-agent: *',
        `Content-Signal: ${signal}`,
        'Allow: /',
        '',
        '# Admin and API routes',
        'Disallow: /_emdash/',
        '',
    ]
    if (!aiTraining) {
        for (const bot of AI_TRAINING_BOTS) {
            lines.push(`User-agent: ${bot}`, 'Disallow: /', '')
        }
    }
    lines.push(`Sitemap: ${origin}/sitemap.xml`, '')
    return lines.join('\n')
}
