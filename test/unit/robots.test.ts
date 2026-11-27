import { describe, expect, it } from 'vitest'
import {
    AI_ANSWER_BOTS,
    AI_TRAINING_BOTS,
    buildRobots,
} from '../../src/lib/robots'

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

    // Answer engines cite a site only if their crawler can reach it; blocking
    // even one makes the business invisible in that assistant. rvnflt's
    // agent-legibility audit fails a site for this.
    it('never blocks AI search or user-triggered crawlers', () => {
        for (const aiTraining of [true, false]) {
            const body = buildRobots({ origin, aiTraining })
            for (const bot of AI_ANSWER_BOTS) {
                expect(body).not.toContain(`User-agent: ${bot}`)
            }
        }
    })

    it('keeps the training and answer lists apart', () => {
        const answer = new Set<string>(AI_ANSWER_BOTS)
        for (const bot of AI_TRAINING_BOTS) {
            expect(answer.has(bot)).toBe(false)
        }
    })

    describe('a context kept out of search', () => {
        const body = buildRobots({
            origin,
            aiTraining: false,
            indexable: false,
        })

        it('says no to search and AI answers and drops the sitemap', () => {
            expect(body).toContain(
                'Content-Signal: ai-train=no, search=no, ai-input=no',
            )
            expect(body).not.toContain('Sitemap:')
        })

        it('still lets crawlers fetch pages, so they see noindex', () => {
            expect(body).toMatch(/User-agent: \*\n(?:.*\n)*?Allow: \/\n/)
            expect(body).toContain('Disallow: /_emdash/')
        })
    })
})
