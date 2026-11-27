import { describe, expect, it } from 'vitest'
import { analyticsSummary, contextAnalytics } from '../../src/lib/analytics'
import { buildContexts } from '../../src/lib/context'

const both = { posthog: true, google: true }
const none = { posthog: false, google: false }

describe('contextAnalytics', () => {
    const [net, org] = buildContexts(
        { name: 'QueerOmaha', url: 'https://queeromaha.net' },
        [
            { id: 'net', host: 'queeromaha.net', canonical: true },
            {
                id: 'org',
                host: 'queeromaha.org',
                analytics: { posthog: false },
            },
        ],
    )

    it('contexts allow everything unless they say otherwise', () => {
        expect(net.analytics).toEqual(both)
        expect(org.analytics).toEqual({ posthog: false, google: true })
    })

    it('runs a tool only where the build has it and the context allows it', () => {
        expect(contextAnalytics(net, both)).toEqual(both)
        expect(contextAnalytics(org, both)).toEqual({
            posthog: false,
            google: true,
        })
        expect(contextAnalytics(net, none)).toEqual(none)
    })
})

describe('analyticsSummary', () => {
    it('names each tool, or says there is none', () => {
        expect(analyticsSummary(both)).toBe(
            'Google Analytics, only if you accept; PostHog, cookieless',
        )
        expect(analyticsSummary({ posthog: true, google: false })).toBe(
            'PostHog, cookieless',
        )
        expect(analyticsSummary(none)).toBe('no analytics')
    })
})
