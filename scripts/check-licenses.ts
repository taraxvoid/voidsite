/**
 * Fail on strong-copyleft licenses in the dependency tree.
 *
 * Usage: aube run check:licenses
 */
import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))

// LGPL is deliberately NOT listed: it only obliges people who modify or
// statically link the library, not those depending on it as-is.
const FAIL_ON = [
    'GPL-1.0',
    'GPL-1.0-only',
    'GPL-1.0-or-later',
    'GPL-2.0',
    'GPL-2.0-only',
    'GPL-2.0-or-later',
    'GPL-3.0',
    'GPL-3.0-only',
    'GPL-3.0-or-later',
    'AGPL-1.0',
    'AGPL-1.0-only',
    'AGPL-1.0-or-later',
    'AGPL-2.0',
    'AGPL-2.0-only',
    'AGPL-2.0-or-later',
    'AGPL-3.0',
    'AGPL-3.0-only',
    'AGPL-3.0-or-later',
    'SSPL-1.0',
    'OSL-2.1',
    'OSL-3.0',
    'CPAL-1.0',
    'EUPL-1.1',
    'EUPL-1.2',
    'CECILL-2.1',
].join(';')

// Reviewed exceptions, pinned to an exact version so a bump re-triggers
// review. emdash (MIT) pulls this GPL-2.0-or-later parser in through its
// WordPress import converter (@emdash-cms/gutenberg-to-portable-text). GPL
// obligations attach to distribution, and a hosted Worker is not distributed
// to visitors. Revisit if emdash drops it or we ever ship the bundle.
const EXCLUDE = ['@wordpress/block-serialization-default-parser@5.56.0'].join(
    ';',
)

const result = spawnSync(
    'aube',
    [
        'exec',
        'license-checker',
        '--summary',
        '--failOn',
        FAIL_ON,
        '--excludePackages',
        EXCLUDE,
    ],
    { cwd: ROOT, stdio: 'inherit' },
)

if (result.error) {
    console.error(`\ncheck:licenses failed to run: ${result.error.message}`)
    process.exit(1)
}
if (result.status !== 0) {
    console.error('\ncheck:licenses failed: a disallowed license was found.')
    process.exit(1)
}
console.log('\ncheck:licenses passed: no blocked licenses found.')
