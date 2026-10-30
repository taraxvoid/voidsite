import { definePlugin } from 'emdash'
import { CTA_DEFAULTS, NEWSLETTER_BLOCK_TYPE } from '../../lib/newsletter-cta'
import type { NewsletterSignupOptions } from './descriptor'

const field = (action_id: keyof typeof CTA_DEFAULTS, label: string) => ({
    type: 'text_input' as const,
    action_id,
    label,
    initial_value: CTA_DEFAULTS[action_id],
})

// The renderer stays registered either way, so pages saved while the
// newsletter was on still render (as nothing) after it is switched off.
export const createPlugin = ({ offerBlock }: NewsletterSignupOptions) =>
    definePlugin({
        id: 'newsletter-signup',
        version: '1.0.0',
        admin: {
            portableTextBlocks: offerBlock
                ? [
                      {
                          type: NEWSLETTER_BLOCK_TYPE,
                          label: 'Newsletter signup',
                          icon: 'mail',
                          category: 'Sections',
                          description: 'Email signup form with a short pitch',
                          fields: [
                              field('heading', 'Heading'),
                              field('copy', 'Copy'),
                              field('button', 'Button label'),
                          ],
                      },
                  ]
                : [],
        },
    })
