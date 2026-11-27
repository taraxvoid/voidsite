/**
 * What analytics this build has, decided from build-time env so the privacy
 * page always describes what the site actually does.
 *
 * PostHog runs cookieless and needs no consent. Google (GA4 and/or Tag
 * Manager) only loads after the visitor accepts; see src/lib/consent.ts.
 */
import { googleTagPlan } from './google-tag'

export const posthogToken: string | undefined = import.meta.env
    .PUBLIC_POSTHOG_PROJECT_TOKEN
export const posthogHost: string =
    import.meta.env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
export const posthogEnabled = Boolean(posthogToken)
// Kept for existing imports.
export const analyticsEnabled = posthogEnabled

export const googlePlan = googleTagPlan(
    import.meta.env.PUBLIC_GA_MEASUREMENT_ID,
    import.meta.env.PUBLIC_GTM_ID,
)
export const googleEnabled = googlePlan !== null

export interface AnalyticsFlags {
    posthog: boolean
    google: boolean
}

/** What this build can run, before any context narrows it. */
export const buildAnalytics: AnalyticsFlags = {
    posthog: posthogEnabled,
    google: googleEnabled,
}

/**
 * What runs in one context (W10): a tool runs when the build has it and the
 * context allows it. The privacy page, the consent banner and the loaders
 * all read this, so the copy follows what each context really does.
 */
export function contextAnalytics(
    context: { analytics: AnalyticsFlags },
    build: AnalyticsFlags = buildAnalytics,
): AnalyticsFlags {
    return {
        posthog: build.posthog && context.analytics.posthog,
        google: build.google && context.analytics.google,
    }
}

/** One line for the privacy page's per-site list. */
export function analyticsSummary(flags: AnalyticsFlags): string {
    const tools = [
        ...(flags.google ? ['Google Analytics, only if you accept'] : []),
        ...(flags.posthog ? ['PostHog, cookieless'] : []),
    ]
    return tools.length === 0 ? 'no analytics' : tools.join('; ')
}
