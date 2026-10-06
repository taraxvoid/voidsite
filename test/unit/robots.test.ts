import { describe, expect, it } from 'vitest'
import { AI_TRAINING_BOTS, buildRobots } from '../../src/lib/robots'

const origin = 'https://example.com'

describe('buildRobots', () => {
    it('always keeps the admin and API out of crawlers', () => {
        for (const aiTraining of [true, false]) {
            expect(buildRobots({ origin, aiTraining })).toContain(
                'Disallow: /_emdash/',
            )
        }
    })

    it('points at the sitemap emdash actually serves', () => {
        const body = buildRobots({ origin, aiTraining: false })
        expect(body).toContain('Sitemap: https://example.com/sitemap.xml')
        expect(body).not.toContain('sitemap-index')
    })

    it('declares a content signal that refuses AI training by default', () => {
        expect(buildRobots({ origin, aiTraining: false })).toContain(
            'Content-Signal: ai-train=no, search=yes, ai-input=yes',
        )
    })

    it('allows AI training when the site opts in', () => {
        const body = buildRobots({ origin, aiTraining: true })
        expect(body).toContain(
            'Content-Signal: ai-train=yes, search=yes, ai-input=yes',
        )
        expect(body).not.toContain('User-agent: GPTBot')
    })

    it('disallows each known training crawler when training is refused', () => {
        const body = buildRobots({ origin, aiTraining: false })
        for (const bot of AI_TRAINING_BOTS) {
            expect(body).toContain(`User-agent: ${bot}\nDisallow: /`)
        }
    })

    it('still lets everyone else in', () => {
        expect(buildRobots({ origin, aiTraining: false })).toMatch(
            /User-agent: \*\n(?:.*\n)*?Allow: \//,
        )
    })
})
