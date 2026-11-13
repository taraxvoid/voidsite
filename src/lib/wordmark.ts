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

/**
 * Bounds the work the patterns below do. A wordmark is a few KB; the strip
 * patterns would go quadratic on a large file full of unclosed `<!--`.
 */
const MAX_LENGTH = 64 * 1024

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

/** Root size attributes, dropped so CSS sizes the wordmark. */
const SIZE = /[\s/](?:width|height)\s*=\s*(?:"[^"]*"|'[^']*')/gi

function refuse(reason: string): never {
    throw new Error(`header.wordmark must not contain ${reason}`)
}

/**
 * The wordmark's markup, checked and ready to inline. It carries no label:
 * SiteHeader wraps it in an element with role="img" and the site title as
 * aria-label, which Astro escapes, so nothing here builds HTML from text.
 */
export function inlineWordmark(source: string): string {
    if (source.length > MAX_LENGTH) {
        throw new Error(
            'header.wordmark is over 64 KB: optimize it (svgo) first',
        )
    }
    const markup = source
        .replace(/<\?xml[\s\S]*?\?>/g, '')
        .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        // Editors write layer names here; they would show as a tooltip.
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

    return open[0].replace(SIZE, '') + markup.slice(open[0].length)
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
): string {
    if (!path) return ''
    const file = files[path]
    if (file === undefined) {
        throw new Error(
            `header.wordmark: ${path} not found; put the file under /src/brand/`,
        )
    }
    return inlineWordmark(file)
}
