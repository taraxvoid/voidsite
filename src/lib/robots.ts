/**
 * robots.txt. Emdash serves a bare-bones one (allow all, block /_emdash/);
 * src/pages/robots.txt.ts replaces it with this so the site can state its AI
 * policy. Search and AI-answer use stay allowed; training is refused unless
 * siteConfig.crawlers.aiTraining is true.
 */

// Crawlers that collect content specifically to train models.
export const AI_TRAINING_BOTS = [
    'GPTBot',
    'CCBot',
    'Google-Extended',
    'ClaudeBot',
    'anthropic-ai',
    'Applebot-Extended',
    'Bytespider',
    'Meta-ExternalAgent',
    'PerplexityBot',
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
