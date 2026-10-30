import { NEWSLETTER_BLOCK_TYPE } from '../../lib/newsletter-cta'
import NewsletterSignupBlock from './NewsletterSignupBlock.astro'

export const blockComponents = {
    [NEWSLETTER_BLOCK_TYPE]: NewsletterSignupBlock,
}
