import { describe, expect, test } from 'vitest'
import {
    buildEmail,
    MAX_MESSAGE,
    parseContact,
    rateLimitKey,
} from '../../src/lib/contact'

const form = (fields: Record<string, string>) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(fields)) f.set(k, v)
    return f
}

describe('parseContact', () => {
    test('accepts a message with a reply email, name optional', () => {
        expect(
            parseContact(form({ message: ' hi ', email: 'a@b.co' })),
        ).toEqual({ kind: 'ok', data: { message: 'hi', email: 'a@b.co' } })
        expect(
            parseContact(form({ message: 'hi', email: 'a@b.co', name: 'Sam' })),
        ).toEqual({
            kind: 'ok',
            data: { message: 'hi', email: 'a@b.co', name: 'Sam' },
        })
    })

    test('flags the honeypot as a bot', () => {
        expect(
            parseContact(
                form({ message: 'hi', email: 'a@b.co', website: 'spam' }),
            ),
        ).toEqual({ kind: 'bot' })
    })

    test.each([
        { message: '', email: 'a@b.co' },
        { message: 'hi', email: '' },
        { message: 'hi', email: 'not an email' },
        { message: 'x'.repeat(MAX_MESSAGE + 1), email: 'a@b.co' },
        { message: 'hi', email: 'a@b.co', name: 'Sam\r\nBcc: x@y.z' },
    ])('rejects %o', (fields) => {
        expect(parseContact(form(fields))).toEqual({ kind: 'invalid' })
    })
})

describe('rateLimitKey', () => {
    test('is stable per IP and never contains the address', async () => {
        const a = await rateLimitKey('https://example.com', '203.0.113.7')
        expect(a).toBe(await rateLimitKey('https://example.com', '203.0.113.7'))
        expect(a).not.toBe(await rateLimitKey('https://example.com', '203.0.113.8'))
        expect(a).not.toContain('203.0.113.7')
        expect(a).toMatch(/^contact:[0-9a-f]{64}$/)
    })
})

describe('buildEmail', () => {
    test('replies go to the sender', () => {
        const email = buildEmail(
            { message: 'hello', email: 'r@co.com', name: 'Sam' },
            'Site',
            'from@x',
            'to@x',
        )
        expect(email.reply_to).toBe('r@co.com')
        expect(email.to).toEqual(['to@x'])
        expect(email.subject).toContain('Sam')
        expect(email.text).toContain('hello')
    })
})

describe('rateLimitKey per site', () => {
    test('the same IP gets different keys on different sites', async () => {
        expect(await rateLimitKey('https://a.example', '203.0.113.7')).not.toBe(
            await rateLimitKey('https://b.example', '203.0.113.7'),
        )
    })
})

describe('buildEmail subject', () => {
    test('names the site', () => {
        expect(
            buildEmail({ message: 'm', email: 'r@co.com' }, 'Site', 'f', 't')
                .subject,
        ).toBe('Site contact')
    })
})
