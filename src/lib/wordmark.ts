/**
 * Inline SVG wordmark for the header (siteConfig.header.wordmark). Inlined
 * rather than an <img> so it can take the header's text color: paths with no
 * fill of their own inherit `fill: currentColor`, so one file follows the
 * light and dark themes, including the theme toggle (which a <picture> with
 * prefers-color-scheme sources would not).
 *
 * The file is the site's own, but it ends up in every page's markup, so
 * anything that can run script is refused rather than cleaned.
 */

const escapeAttr = (value: string) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')

/** Root attributes this function sets itself, or drops so CSS can size it. */
const REPLACED = [
    'width',
    'height',
    'class',
    'role',
    'aria-label',
    'aria-hidden',
]

export function inlineWordmark(source: string, label: string): string {
    const markup = source
        .replace(/<\?xml[\s\S]*?\?>/g, '')
        .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        // Editors write layer names here; it would compete with aria-label.
        .replace(/<title[\s\S]*?<\/title>/gi, '')
        .trim()

    const open = /^<svg\b([^>]*)>/i.exec(markup)
    if (!open || !/<\/svg>$/i.test(markup)) {
        throw new Error('header.wordmark must be an <svg> file')
    }
    if (/<script\b/i.test(markup)) {
        throw new Error('header.wordmark must not contain <script>')
    }
    if (/<foreignObject\b/i.test(markup)) {
        throw new Error('header.wordmark must not contain <foreignObject>')
    }
    if (/\son[a-z]+\s*=/i.test(markup)) {
        throw new Error('header.wordmark must not contain event handlers')
    }

    let attrs = open[1]
    for (const name of REPLACED) {
        attrs = attrs.replace(
            new RegExp(`\\s${name}\\s*=\\s*("[^"]*"|'[^']*')`, 'gi'),
            '',
        )
    }
    const root = `<svg${attrs} class="brand-logo brand-logo-svg" role="img" aria-label="${escapeAttr(label)}">`
    return root + markup.slice(open[0].length)
}
