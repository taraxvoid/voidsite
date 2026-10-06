/**
 * Fail if the template's placeholders are still in place.
 *
 * Usage: pnpm run check:placeholders (CI's deploy job runs it; it is not part
 * of validate, because the template repo itself is full of placeholders).
 */
import { readFileSync } from 'node:fs'
import { findPlaceholders } from '../src/lib/placeholders.ts'

const files = Object.fromEntries(
    ['src/site.config.ts', 'wrangler.jsonc'].map((path) => [
        path,
        readFileSync(path, 'utf8'),
    ]),
)

const found = findPlaceholders(files)
if (found.length > 0) {
    console.error('check:placeholders failed. Replace these before deploying:')
    for (const line of found) console.error(`  ${line}`)
    process.exit(1)
}
console.log('check:placeholders passed: no template placeholders left.')
