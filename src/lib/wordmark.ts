/**
 * Inline SVG wordmark for the header (siteConfig.header.wordmark). Inlined
 * rather than an <img> so it can take the header's text color: paths with no
 * fill of their own inherit `fill: currentColor`, so one file follows the
 * light and dark themes, including the theme toggle (which a <picture> with
 * prefers-color-scheme sources would not).
 *
 * The file is the site's own and read at build time, but it ends up in every
 * page's markup, so it is held to a drawing: an allowlist of elements, no
 * references outside the file, nothing that can run script. Anything else is
 * refused rather than cleaned, with a message saying what to fix (svgo's
 * defaults, plus convertStyleToAttrs/inlineStyles, produce a file that
 * passes).
 */

const escapeAttr = (value: string) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('"', '&quot;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')

/**
 * Drawing elements, lowercased. Not here on purpose: a (would nest inside
 * the home link), image and feImage (load resources), style (its rules would
 * apply to the whole page), script, foreignObject, set and animate* (can
 * rewrite attributes after the checks below).
 */
const ALLOWED_ELEMENTS = new Set([
    'svg',
    'g',
    'defs',
    'symbol',
    'use',
    'path',
    'rect',
    'circle',
    'ellipse',
    'line',
    'polyline',
    'polygon',
    'text',
    'tspan',
    'lineargradient',
    'radialgradient',
    'stop',
    'clippath',
    'mask',
    'desc',
    'metadata',
])

/** Root attributes this function sets itself, or drops so CSS can size it. */
const REPLACED =
    /[\s/](?:width|height|class|role|aria-label|aria-hidden)\s*=\s*(?:"[^"]*"|'[^']*')/gi

function refuse(reason: string): never {
    throw new Error(`header.wordmark must not contain ${reason}`)
}

export function inlineWordmark(source: string, label: string): string {
    const markup = source
        .replace(/<\?xml[\s\S]*?\?>/g, '')
        .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        // Editors write layer names here; it would compete with aria-label.
        .replace(/<title[\s\S]*?<\/title>/gi, '')
        .trim()

    // Checked after stripping, so a comment can't split a tag past them.
    const open = /^<svg\b([^>]*)>/i.exec(markup)
    if (!open || !/<\/svg>$/i.test(markup)) {
        throw new Error('header.wordmark must be an <svg> file')
    }

    // Only the five XML entities: the HTML parser decodes the rest (&lpar;,
    // &colon;, &#106;) before CSS or URLs see them, which would let a value
    // slip past the checks below.
    if (/&(?!(?:amp|lt|gt|quot|apos);)/i.test(markup)) {
        refuse('character references other than &amp; &lt; &gt; &quot; &apos;')
    }

    for (const [, name] of markup.matchAll(/<([a-z][\w.:-]*)/gi)) {
        // Editor namespaces (sodipodi:, inkscape:) are inert in HTML.
        if (name.includes(':')) continue
        if (!ALLOWED_ELEMENTS.has(name.toLowerCase())) {
            refuse(`the <${name}> element (allowed: drawing elements only)`)
        }
    }

    // HTML parsing treats `/` as an attribute separator: <path/onload=...>.
    if (/[\s/]on[a-z]+\s*=/i.test(markup)) refuse('event handlers')
    if (/javascript\s*:/i.test(markup)) refuse('javascript: URLs')
    // References stay inside the file: href="#id", url(#id).
    if (/[\s/](?:xlink:)?href\s*=\s*(?!["']\s*#)/i.test(markup)) {
        refuse('an href to anything but an #id in the file')
    }
    if (/url\s*\(\s*(?!["']?\s*#)/i.test(markup)) {
        refuse('a url() to anything but an #id in the file')
    }

    const attrs = open[1].replace(REPLACED, '')
    const root = `<svg${attrs} class="brand-logo brand-logo-svg" role="img" aria-label="${escapeAttr(label)}">`
    return root + markup.slice(open[0].length)
}

/**
 * The header's wordmark markup: '' when none is configured, otherwise the
 * configured file from the bundled `files` (keyed like '/src/brand/x.svg'),
 * inlined. A configured file that isn't there fails the build rather than
 * quietly falling back to the site name.
 */
export function resolveWordmark(
    files: Record<string, string>,
    path: string,
    label: string,
): string {
    if (!path) return ''
    const file = files[path]
    if (file === undefined) {
        throw new Error(
            `header.wordmark: ${path} not found (expected /src/brand/<name>.svg)`,
        )
    }
    return inlineWordmark(file, label)
}
