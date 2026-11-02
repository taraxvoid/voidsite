import { siteConfig } from '../../src/site.config'

// Every public page; add new ones as they are created. /contact joins when
// the form is enabled in site.config.ts.
export const publicPaths = (contactEnabled: boolean) => [
    '/',
    '/privacy',
    '/terms',
    '/accessibility',
    ...(contactEnabled ? ['/contact'] : []),
]

export const paths = publicPaths(siteConfig.contact.enabled)
