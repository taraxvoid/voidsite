import { describe, expect, test } from 'vitest'
import { inlineWordmark, resolveWordmark } from '../../src/lib/wordmark'

const svg = (attrs = '', body = '<path d="M0 0h10v10H0z"/>') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20"${attrs}>${body}</svg>`

describe('inlineWordmark', () => {
    test('returns the svg itself: the header names it, not the file', () => {
        const out = inlineWordmark(svg())
        expect(out).toMatch(/^<svg /)
        expect(out).not.toContain('aria-label')
    })

    test('keeps the viewBox and drawing', () => {
        const out = inlineWordmark(svg())
        expect(out).toContain('viewBox="0 0 100 20"')
        expect(out).toContain('<path d="M0 0h10v10H0z"/>')
    })

    test('drops the root width and height so CSS sizes it', () => {
        const out = inlineWordmark(svg(' width="100px" height=\'20\''))
        const root = out.slice(0, out.indexOf('>'))
        expect(root).not.toMatch(/\swidth=/)
        expect(root).not.toMatch(/\sheight=/)
    })

    test('leaves width and height on child elements alone', () => {
        const out = inlineWordmark(svg('', '<rect width="5" height="5"/>'))
        expect(out).toContain('<rect width="5" height="5"/>')
    })

    test('strips the XML prolog, doctype, comments and editor titles', () => {
        const file = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">
<!-- Generator: something -->
${svg('', '<title>Layer 1</title><path d="M0 0"/>')}
`
        const out = inlineWordmark(file)
        expect(out).toMatch(/^<svg /)
        expect(out).not.toContain('<?xml')
        expect(out).not.toContain('DOCTYPE')
        expect(out).not.toContain('Generator')
        // Editors' layer names would show as a hover tooltip.
        expect(out).not.toContain('Layer 1')
        expect(out).toMatch(/<\/svg>$/)
    })

    test('refuses an oversized file before running any pattern on it', () => {
        const huge = svg('', '<!--'.repeat(40_000))
        expect(() => inlineWordmark(huge)).toThrow(/64 KB/)
    })

    test('refuses a file that is not an svg', () => {
        expect(() => inlineWordmark('<div></div>')).toThrow(/svg/)
        expect(() => inlineWordmark('')).toThrow(/svg/)
    })

    test('refuses scripts and event handlers: it is inlined into every page', () => {
        expect(() =>
            inlineWordmark(svg('', '<script>alert(1)</script>')),
        ).toThrow(/script/)
        expect(() => inlineWordmark(svg('', '<path onclick="x()"/>'))).toThrow(
            /event handler/,
        )
        expect(() => inlineWordmark(svg('', '<foreignObject/>'))).toThrow(
            /foreignObject/,
        )
    })

    test('catches handlers after a slash, which HTML treats as a separator', () => {
        expect(() => inlineWordmark(svg('', '<path/onload="x()"/>'))).toThrow(
            /event handler/,
        )
        expect(() =>
            inlineWordmark('<svg/onload="x()" viewBox="0 0 1 1"></svg>'),
        ).toThrow(/event handler/)
    })

    test('refuses javascript: URLs, however they are cased or spaced', () => {
        expect(() =>
            inlineWordmark(svg('', '<use href="javascript:x()"/>')),
        ).toThrow(/javascript:/)
        expect(() =>
            inlineWordmark(svg('', '<use href=" JavaScript :x()"/>')),
        ).toThrow(/javascript:/)
    })

    test('does not mistake ordinary attributes for handlers', () => {
        expect(() =>
            inlineWordmark(svg('', '<path data-one="1" font="x"/>')),
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
        expect(() => inlineWordmark(svg('', body))).not.toThrow()
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
        expect(() => inlineWordmark(svg('', body))).toThrow(/element/)
    })

    test.each([
        ['an external href', '<use href="https://evil.example/x.svg#a"/>'],
        ['an external xlink:href', '<use xlink:href="other.svg#a"/>'],
        ['a data: href', '<use href="data:image/svg+xml,x"/>'],
        ['an unquoted href', '<use href=x.svg/>'],
    ])('refuses %s', (_, body) => {
        expect(() => inlineWordmark(svg('', body))).toThrow(/href/)
    })

    test.each([
        [
            'in a style attribute',
            '<path style="fill:url(https://evil.example/a)"/>',
        ],
        ['in a presentation attribute', '<path fill="url(x.svg#a)"/>'],
        ['quoted', '<path fill="url(\'https://evil.example\')"/>'],
    ])('refuses an external url() %s', (_, body) => {
        expect(() => inlineWordmark(svg('', body))).toThrow(/url\(\)/)
    })

    test('refuses character references that could disguise a check', () => {
        expect(() =>
            inlineWordmark(svg('', '<path style="fill:url&lpar;x)"/>')),
        ).toThrow(/character reference/)
        expect(() =>
            inlineWordmark(svg('', '<path data-x="&#106;"/>')),
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
        expect(resolveWordmark(fixtures, '')).toBe('')
    })

    test('loads the configured file through the bundler and inlines it', () => {
        const out = resolveWordmark(
            fixtures,
            '/test/fixtures/brand/wordmark.svg',
        )
        expect(out).toMatch(/^<svg /)
        expect(out).toContain('fill="#DE9917"')
        expect(out).not.toContain('Layer 1')
    })

    test('fails the build when the configured file is missing', () => {
        expect(() =>
            resolveWordmark(fixtures, '/test/fixtures/brand/nope.svg'),
        ).toThrow(/nope\.svg not found/)
    })
})
