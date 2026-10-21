# Redirect and URL continuity (roadmap W3, first slice)

Status: draft for review, 2026-09-30. Roadmap: `docs/roadmap.md` section 4, W3.

## 1. Intent

When a site moves onto voidsite (Heritage Law first, a WordPress migration),
every old URL keeps working, so rvnflt finding history and search rankings
survive. This slice delivers the core library and the two scripts that apply
and verify the rules. It does not build the old-URL inventory (sitemap, crawl,
WXR, Search Console importers), the third-party embed inventory, or the
30-day 404 watch. Those are later slices.

Success: for a client with a committed `migration/old-urls.txt`, one command
proposes rules and lists what a person must decide, one command applies the
reviewed rules to a Worker Preview, and one command proves that each old URL
is a single-hop 301 to a 200 whose canonical is itself, or an explicit 410.

## 2. Constraints

- Emdash redirect rules: 301, 302, 307, 308, or terminal 410 and 451.
  Sources accept `[slug]` and `[...path]`. Seeds take 301, 302, 307 and 308
  only, so 410s go through the REST API (`/_emdash/api/redirects`, Bearer
  token). The API rejects duplicate sources, self-loops and multi-hop loops,
  and updates need the `_rev` returned by a read.
- URL policy (roadmap section 2): one trailing-slash form, dateless routes,
  every URL change ships with a redirect.
- The join key with rvnflt is the page URL. Host identity uses bschool's
  `businessKey`, not a local normalizer (ruling R1).
- No new cookie, storage key or visitor-facing third-party request, so the
  privacy page and `legal.spec.ts` do not change.
- Style: Biome, 4 spaces, single quotes, no semicolons, 80 columns. Pure
  logic gets a unit test first.

## 3. Rulings

- **R1. Host comparison uses bschool `businessKey`; paths are ours.**
  `businessKey` (in `@ravenflight/bschool`, PR #1) is host-only: lowercase,
  no `www.`, port or trailing dot; scheme, path, query and fragment dropped.
  bschool has no path rules, so trailing slash, tracking params, `index.php`
  and `?p=` handling live in `redirects.ts`. Cost if wrong: path rules
  diverge from a future bschool path rule; one function to change.
- **R2. The package is not installable yet** (`0.0.1`, unpublished, PR open).
  `redirects.ts` stays pure and receives the host function as a parameter and
  never imports bschool. Scripts pass the real `businessKey`; unit tests pass
  a stub. Adding the dependency is the last plan task and is gated on the
  bschool PR merging. Cost if wrong: scripts run with a stub host function
  until then, which is acceptable for unit work but not for a real migration.
- **R3. Apply defaults to dry run.** Writing redirects to a live site needs
  an explicit `--apply`.

## 4. Library: `src/lib/redirects.ts`

Pure, no I/O, no imports from bschool.

```ts
type HostKey = (url: string) => string | null

interface NormalizeOptions {
    siteUrl: string // the new site's origin
    hostKey: HostKey // R1, R2
    trailingSlash: 'always' | 'never'
    dropParams?: RegExp // default: /^(utm_|fbclid$|gclid$|mc_)/
}

type Normalized =
    | { kind: 'path'; path: string }
    | { kind: 'id'; path: string; query: string } // ?p=123, ?page_id=4
    | { kind: 'foreign'; url: string } // different business key
    | { kind: 'invalid'; input: string }
```

- `normalizeUrl(input, opts)`: accepts a full URL or a path. Returns
  `foreign` when `hostKey(input)` differs from `hostKey(siteUrl)`. Strips
  fragment, tracking params and `index.php` / `index.html`, collapses
  duplicate slashes, lowercases nothing in the path (paths are
  case-sensitive), applies the trailing-slash form, percent-decodes unreserved
  characters only. WordPress ID URLs (`?p=`, `?page_id=`, `?cat=`) are kept as
  `id` because slug matching cannot resolve them.
- `matchUrls(oldPaths, newPaths)`: per old path, one result:
  `same` (already a live path, no rule), `slug` (the last segment equals
  exactly one new path's last segment), `ambiguous` (several candidates,
  listed), `unmatched`.
- `buildRules(results, reviewed)`: emits `{source, destination, status}`.
  `reviewed` decisions (section 5) win over proposals. Collapses chains,
  throws on loops and self-redirects, sorts deterministically.
- `unmatchedQueue(results, weights?)`: the to-do list for a person, unmatched
  and ambiguous, sorted by weight (Search Console clicks) descending then
  path.

## 5. File formats (per client repo)

- `migration/old-urls.txt`: one URL or path per line; blank lines and `#`
  comments ignored; an optional tab-separated second column is a numeric
  weight.
- `migration/redirects.json`: the reviewed decisions, committed. Array of
  `{source, destination, status, note?}`. `destination: null` requires
  `status: 410` (explicit gone); 451 is allowed for legal removals.
  Source paths use the normalized form. A rule here overrides any proposal.

## 6. Scripts (all network I/O)

- `scripts/plan-redirects.ts --site <url>`: reads `old-urls.txt`, fetches the
  site's `/sitemap.xml` (recursing into sitemap indexes) for new paths, runs
  the library, writes proposals to stdout as JSON merged with the existing
  `redirects.json` (never overwriting reviewed entries) and prints the
  unmatched queue. Writes `redirects.json` only with `--write`.
- `scripts/apply-redirects.ts --site <url> [--apply]`: reads
  `redirects.json`, lists existing rules, then creates, updates (with
  `_rev`) or skips identical ones. Never deletes. Dry run by default (R3).
  Token from `EMDASH_TOKEN`; never logged.
- `scripts/check-redirects.ts --site <preview-url>`: for each old URL, follows
  redirects manually and asserts: a single-hop 301 to a 200 whose
  `rel=canonical` equals the final URL, or a 410 where `redirects.json`
  says gone. Exits nonzero with a per-URL failure table. `same` URLs must
  return 200 with a self-canonical.
- `package.json`: `check:redirects`, `plan:redirects`, `apply:redirects`.
  `check:redirects` is not in pre-push because it needs a live Preview.
  Scripts follow the existing `scripts/*.ts` style (Node type stripping, as
  `check-licenses.ts`).

## 7. Testing

- Vitest unit tests for the library with fixtures shaped like Heritage Law
  (`/[category]/[service]/`, trailing slash, WordPress `?p=` URLs, `www`
  and non-`www`, `utm_` params, an `http` variant, one foreign host).
  Written first, watched failing.
- Script tests with a mocked `fetch`: apply (create, update with `_rev`,
  skip identical, dry run writes nothing), check (single hop pass, two-hop
  fail, 200 without self-canonical fail, 410 pass), sitemap index recursion.
- After the bschool dependency lands: one test runs the library with the
  real `businessKey` to confirm `www`, port and trailing-dot equivalence.
- No e2e; there is no UI.

## 8. Out of scope

Inventory builders, embed inventory, 404-log watch, an Emdash plugin,
redirect deletion, regex or wildcard rule generation, anything in section
mode.

## 9. Risks

- Slug matching is a proposal, not truth. A wrong 301 silently misdirects a
  page, so proposals never apply without the reviewed file, and the queue
  lists `ambiguous` explicitly.
- The apply script writes production rules. R3 and the Preview-first flow
  mitigate it.
- `businessKey` is a claim, not proof of ownership; here it only decides
  whether a listed URL belongs to this site.
