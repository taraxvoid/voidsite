import { siteConfig } from '../site.config'
import { googleEnabled, posthogEnabled } from './analytics'
import { providers } from './newsletter'

const { contact, newsletter } = siteConfig
const newsletterProvider = providers[newsletter.provider]

/**
 * Everyone who processes visitor data for this build: the vendors listed in
 * site.config.ts plus whichever analytics the build has switched on, so the
 * list can't fall out of step with the site.
 */
export const subProcessors = [
    ...siteConfig.subProcessors,
    ...(contact.enabled || newsletter.enabled
        ? [
              {
                  name: 'Cloudflare Turnstile',
                  purpose: `Bot check on ${
                      contact.enabled && newsletter.enabled
                          ? 'the contact and subscribe forms'
                          : contact.enabled
                            ? 'the contact form (contact page only)'
                            : 'the subscribe form (subscribe page only)'
                  }`,
                  url: 'https://www.cloudflare.com/turnstile-privacy-policy/',
              },
          ]
        : []),
    ...(newsletter.enabled
        ? [
              {
                  name: newsletterProvider.name,
                  purpose: 'Sends the newsletter and keeps its subscriber list',
                  url: newsletterProvider.privacyUrl,
              },
          ]
        : []),
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
