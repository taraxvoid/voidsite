import { describe, expect, test } from 'vitest'
import {
    businessSchema,
    compact,
    faqSchema,
    type SiteIdentity,
    toJsonLdScript,
} from '../../src/lib/structured-data'
import { siteConfig } from '../../src/site.config'

const site = (business: Partial<SiteIdentity['business']> = {}) => ({
    name: 'Soundry',
    description: 'Experimental music education.',
    url: 'https://example.org',
    contactEmail: 'hi@example.org',
    business: {
        type: 'MusicSchool',
        logo: '',
        telephone: '',
        address: { addressLocality: '', addressRegion: '' },
        areaServed: '',
        sameAs: [],
        services: [],
        ...business,
    },
})

describe('businessSchema', () => {
    test('minimal config: identity only, no empty fields', () => {
        expect(businessSchema(site())).toEqual({
            '@context': 'https://schema.org',
            '@type': 'MusicSchool',
            '@id': 'https://example.org/#business',
            name: 'Soundry',
            description: 'Experimental music education.',
            url: 'https://example.org',
            email: 'hi@example.org',
        })
    })

    test('address, area, profiles and services when given', () => {
        const s = businessSchema(
            site({
                address: { addressLocality: 'Omaha', addressRegion: 'NE' },
                areaServed: 'Omaha, NE',
                sameAs: ['https://github.com/x'],
                services: [{ name: 'Lessons', description: 'Weekly.' }],
            }),
        )
        expect(s.address).toEqual({
            '@type': 'PostalAddress',
            addressLocality: 'Omaha',
            addressRegion: 'NE',
        })
        expect(s.areaServed).toBe('Omaha, NE')
        expect(s.sameAs).toEqual(['https://github.com/x'])
        expect(JSON.stringify(s.hasOfferCatalog)).toContain('"Lessons"')
    })

    test('an invalid type falls back to Organization', () => {
        expect(businessSchema(site({ type: 'not a type' }))['@type']).toBe(
            'Organization',
        )
    })

    test('the template config builds', () => {
        expect(businessSchema(siteConfig)['@type']).toBe('Organization')
    })
})

describe('faqSchema', () => {
    test('null for no questions, FAQPage otherwise', () => {
        expect(faqSchema([])).toBeNull()
        expect(
            faqSchema([{ question: 'Q?', answer: 'A.' }])?.mainEntity[0],
        ).toEqual({
            '@type': 'Question',
            name: 'Q?',
            acceptedAnswer: { '@type': 'Answer', text: 'A.' },
        })
    })
})

describe('helpers', () => {
    test('compact keeps zero and false', () => {
        expect(compact({ a: 0, b: false, c: '' })).toEqual({ a: 0, b: false })
    })
    test('toJsonLdScript cannot close the script tag', () => {
        expect(toJsonLdScript({ name: '</script><b>' })).not.toContain('</')
    })
})
