/**
 * Copy for the newsletter signup CTA, shared by the editor block (its
 * defaults) and the component that renders it.
 */

/** Portable Text `_type` of the editor block. */
export const NEWSLETTER_BLOCK_TYPE = 'newsletter_signup'

export type CtaContent = { heading: string; copy: string; button: string }

export const CTA_DEFAULTS: Readonly<CtaContent> = Object.freeze({
    heading: 'Get new posts by email',
    copy: 'One email when something new goes up. Unsubscribe any time.',
    button: 'Subscribe',
})

// One line of text, or the default when the editor left it blank.
const line = (value: unknown, fallback: string) => {
    const text =
        typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
    return text || fallback
}

/** What the CTA shows, or null when the newsletter is off. */
export const ctaContent = (
    fields: Partial<Record<keyof CtaContent, unknown>>,
    enabled: boolean,
): CtaContent | null =>
    enabled
        ? {
              heading: line(fields.heading, CTA_DEFAULTS.heading),
              copy: line(fields.copy, CTA_DEFAULTS.copy),
              button: line(fields.button, CTA_DEFAULTS.button),
          }
        : null
