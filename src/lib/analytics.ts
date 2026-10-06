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
