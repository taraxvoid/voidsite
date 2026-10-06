import { siteConfig } from '../site.config'
import { googleEnabled, posthogEnabled } from './analytics'

/**
 * Everyone who processes visitor data for this build: the vendors listed in
 * site.config.ts plus whichever analytics the build has switched on, so the
 * list can't fall out of step with the site.
 */
export const subProcessors = [
    ...siteConfig.subProcessors,
    ...(posthogEnabled
        ? [
              {
                  name: 'PostHog',
                  purpose: 'Cookieless, aggregate analytics',
                  url: 'https://posthog.com/privacy',
              },
          ]
        : []),
    ...(googleEnabled
        ? [
              {
                  name: 'Google',
                  purpose: 'Analytics, only after you accept analytics cookies',
                  url: 'https://policies.google.com/privacy',
              },
          ]
        : []),
]
