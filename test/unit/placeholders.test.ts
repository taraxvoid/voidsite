import { describe, expect, it } from 'vitest'
import { findPlaceholders } from '../../src/lib/placeholders'

describe('findPlaceholders', () => {
    it('is empty for a configured site', () => {
        expect(
            findPlaceholders({
                'src/site.config.ts': "url: 'https://mysite.org'",
                'wrangler.jsonc': '"database_id": "0b7c-real-id"',
            }),
        ).toEqual([])
    })

    it.each([
        ['src/site.config.ts', "url: 'https://example.com'", 'example.com'],
        ['src/site.config.ts', "entity: 'Example, LLC'", 'Example, LLC'],
        [
            'src/site.config.ts',
            "jurisdiction: 'your jurisdiction'",
            'your jurisdiction',
        ],
        ['wrangler.jsonc', '"REPLACE-WITH-PREVIEW-D1-ID"', 'REPLACE-WITH'],
    ])('flags %s containing %s', (file, text, needle) => {
        const found = findPlaceholders({ [file]: text })
        expect(found).toHaveLength(1)
        expect(found[0]).toContain(file)
        expect(found[0]).toContain(needle)
    })

    it('reports every file and pattern, so one run shows all the work left', () => {
        const found = findPlaceholders({
            'src/site.config.ts':
                "url: 'https://example.com', entity: 'Example, LLC'",
            'wrangler.jsonc': 'REPLACE-WITH-X',
        })
        expect(found).toHaveLength(3)
    })
})
