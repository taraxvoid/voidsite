import { describe, expect, test } from 'vitest'
import { inlineWordmark, resolveWordmark } from '../../src/lib/wordmark'

const svg = (attrs = '', body = '<path d="M0 0h10v10H0z"/>') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20"${attrs}>${body}</svg>`

describe('inlineWordmark', () => {
    test('labels the svg as one image named after the site', () => {
        const out = inlineWordmark(svg(), 'Foxlight')
        expect(out).toMatch(/^<svg /)
        expect(out).toContain('role="img"')
        expect(out).toContain('aria-label="Foxlight"')
        expect(out).toContain('class="brand-logo brand-logo-svg"')
    })

    test('keeps the viewBox and drawing', () => {
        const out = inlineWordmark(svg(), 'x')
        expect(out).toContain('viewBox="0 0 100 20"')
        expect(out).toContain('<path d="M0 0h10v10H0z"/>')
    })

    test('drops the root width and height so CSS sizes it', () => {
        const out = inlineWordmark(svg(' width="100px" height=\'20\''), 'x')
        const root = out.slice(0, out.indexOf('>'))
        expect(root).not.toMatch(/\swidth=/)
        expect(root).not.toMatch(/\sheight=/)
    })

    test('leaves width and height on child elements alone', () => {
        const out = inlineWordmark(svg('', '<rect width="5" height="5"/>'), 'x')
        expect(out).toContain('<rect width="5" height="5"/>')
    })

    test('replaces any role, label or class the file already had', () => {
        const out = inlineWordmark(
            svg(' class="logo" role="presentation" aria-label="old"'),
            'New',
        )
        expect(out.match(/\sclass=/g)).toHaveLength(1)
        expect(out.match(/\srole=/g)).toHaveLength(1)
        expect(out).toContain('aria-label="New"')
        expect(out).not.toContain('old')
    })

    test('strips the XML prolog, doctype, comments and editor titles', () => {
        const file = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">
<!-- Generator: something -->
${svg('', '<title>Layer 1</title><path d="M0 0"/>')}
`
        const out = inlineWordmark(file, 'x')
        expect(out).toMatch(/^<svg /)
        expect(out).not.toContain('<?xml')
        expect(out).not.toContain('DOCTYPE')
        expect(out).not.toContain('Generator')
        // A <title> would override aria-label as the name in some readers.
        expect(out).not.toContain('Layer 1')
        expect(out).toMatch(/<\/svg>$/)
    })

    test('escapes the label', () => {
        const out = inlineWordmark(svg(), 'A "B" & <C>')
        expect(out).toContain('aria-label="A &quot;B&quot; &amp; &lt;C&gt;"')
    })

    test('refuses a file that is not an svg', () => {
        expect(() => inlineWordmark('<div></div>', 'x')).toThrow(/svg/)
        expect(() => inlineWordmark('', 'x')).toThrow(/svg/)
    })

    test('refuses scripts and event handlers: it is inlined into every page', () => {
        expect(() =>
            inlineWordmark(svg('', '<script>alert(1)</script>'), 'x'),
        ).toThrow(/script/)
        expect(() =>
            inlineWordmark(svg('', '<path onclick="x()"/>'), 'x'),
        ).toThrow(/event handler/)
        expect(() => inlineWordmark(svg('', '<foreignObject/>'), 'x')).toThrow(
            /foreignObject/,
        )
    })

    test('catches handlers after a slash, which HTML treats as a separator', () => {
        expect(() =>
            inlineWordmark(svg('', '<path/onload="x()"/>'), 'x'),
        ).toThrow(/event handler/)
        expect(() =>
            inlineWordmark('<svg/onload="x()" viewBox="0 0 1 1"></svg>', 'x'),
        ).toThrow(/event handler/)
    })

    test('refuses javascript: URLs, however they are cased or spaced', () => {
        expect(() =>
            inlineWordmark(svg('', '<use href="javascript:x()"/>'), 'x'),
        ).toThrow(/javascript:/)
        expect(() =>
            inlineWordmark(svg('', '<use href=" JavaScript :x()"/>'), 'x'),
        ).toThrow(/javascript:/)
    })

    test('does not mistake ordinary attributes for handlers', () => {
        expect(() =>
            inlineWordmark(svg('', '<path data-one="1" font="x"/>'), 'x'),
        ).not.toThrow()
    })

    test('allows the drawing elements editors and svgo produce', () => {
        const body =
            '<defs><linearGradient id="g"><stop offset="0"/></linearGradient>' +
            '<clipPath id="c"><rect width="1" height="1"/></clipPath></defs>' +
            '<g clip-path="url(#c)" fill="url(\'#g\')"><circle r="1"/>' +
            '<ellipse rx="1" ry="1"/><line x2="1"/><polyline points="0 0"/>' +
            '<polygon points="0 0"/><use href="#c"/><use xlink:href="#c"/>' +
            '<text>Fox &amp; co</text></g>' +
            '<sodipodi:namedview pagecolor="#fff"/>'
        expect(() => inlineWordmark(svg('', body), 'x')).not.toThrow()
    })

    test.each([
        ['a link, which would nest inside the home link', '<a><path/></a>'],
        ['an image, which loads a resource', '<image href="#x"/>'],
        [
            'a style sheet, whose rules would leak into the page',
            '<style>.a{}</style>',
        ],
        [
            'animation, which can rewrite attributes',
            '<set attributeName="fill" to="red"/>',
        ],
        [
            'animation, which can rewrite attributes',
            '<animate attributeName="x"/>',
        ],
        ['an iframe', '<iframe/>'],
    ])('refuses %s', (_, body) => {
        expect(() => inlineWordmark(svg('', body), 'x')).toThrow(/element/)
    })

    test.each([
        ['an external href', '<use href="https://evil.example/x.svg#a"/>'],
        ['an external xlink:href', '<use xlink:href="other.svg#a"/>'],
        ['a data: href', '<use href="data:image/svg+xml,x"/>'],
        ['an unquoted href', '<use href=x.svg/>'],
    ])('refuses %s', (_, body) => {
        expect(() => inlineWordmark(svg('', body), 'x')).toThrow(/href/)
    })

    test.each([
        [
            'in a style attribute',
            '<path style="fill:url(https://evil.example/a)"/>',
        ],
        ['in a presentation attribute', '<path fill="url(x.svg#a)"/>'],
        ['quoted', '<path fill="url(\'https://evil.example\')"/>'],
    ])('refuses an external url() %s', (_, body) => {
        expect(() => inlineWordmark(svg('', body), 'x')).toThrow(/url\(\)/)
    })

    test('refuses character references that could disguise a check', () => {
        expect(() =>
            inlineWordmark(svg('', '<path style="fill:url&lpar;x)"/>'), 'x'),
        ).toThrow(/character reference/)
        expect(() =>
            inlineWordmark(svg('', '<path data-x="&#106;"/>'), 'x'),
        ).toThrow(/character reference/)
    })
})

// The build path: SiteHeader bundles src/brand/*.svg with this same glob
// shape (raw strings, eager), so this runs the real Vite ?raw import.
const fixtures = import.meta.glob<string>('/test/fixtures/brand/*.svg', {
    query: '?raw',
    import: 'default',
    eager: true,
})

describe('resolveWordmark', () => {
    test('is empty when no wordmark is configured', () => {
        expect(resolveWordmark(fixtures, '', 'Site')).toBe('')
    })

    test('loads the configured file through the bundler and inlines it', () => {
        const out = resolveWordmark(
            fixtures,
            '/test/fixtures/brand/wordmark.svg',
            'Foxlight',
        )
        expect(out).toMatch(/^<svg /)
        expect(out).toContain('aria-label="Foxlight"')
        expect(out).toContain('fill="#DE9917"')
        expect(out).not.toContain('Layer 1')
    })

    test('fails the build when the configured file is missing', () => {
        expect(() =>
            resolveWordmark(fixtures, '/test/fixtures/brand/nope.svg', 'x'),
        ).toThrow(/nope\.svg not found/)
    })
})
