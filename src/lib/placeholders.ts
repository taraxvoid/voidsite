/**
 * Template placeholders that must be replaced before a real deploy. CI's
 * deploy job runs scripts/check-placeholders.ts, so a fresh copy of the
 * template can't ship "example.com" or "your jurisdiction" to production.
 */

const PLACEHOLDERS: [label: string, pattern: RegExp][] = [
    ['example.com', /example\.com/],
    ['Example, LLC', /Example, LLC/],
    ['your jurisdiction', /your jurisdiction/],
    ['REPLACE-WITH', /REPLACE-WITH/],
]

// `files` maps a path to its text. Returns one line per file and pattern hit.
export function findPlaceholders(files: Record<string, string>): string[] {
    const found: string[] = []
    for (const [path, text] of Object.entries(files)) {
        for (const [label, pattern] of PLACEHOLDERS) {
            if (pattern.test(text)) found.push(`${path}: still has "${label}"`)
        }
    }
    return found
}
