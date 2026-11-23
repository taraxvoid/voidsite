# Multi-domain contexts (roadmap W10)

Status: draft for review, 2026-11-23. Roadmap: `docs/roadmap.md` section 4,
W10. First consumer: QueerOmaha (queeromaha.net, queeromaha.org,
queeromaha.dev), which builds on W9 (directory) and #46 (newsletter).

## 1. Intent

One voidsite deployment (one Worker, one D1, one Emdash admin) serves several
domains. Each domain is a **context**: its own name, wordmark, menu, home
page, discovery files (sitemap, robots, `llms.txt`, JSON-LD), analytics and
indexing policy, and its own slice of shared content. A header switcher lets
visitors move between contexts. A site with one domain is a site with one
context, and behaves exactly as today.

This is a new deployment shape next to the roadmap's three (clean build,
migration, section mode): **one deploy, many hosts**. It does not replace
per-client repos; it lets one client run a family of related sites without a
repo and a Worker per domain.

Success, for QueerOmaha:

- queeromaha.net, queeromaha.org and queeromaha.dev answer from one Worker,
  each with its own home, header lockup, menu and discovery files.
- Editors sign in once, on queeromaha.net, and publish to any context.
- Every queeromaha.net permalink still returns 200 after the move (W3).
- Nothing about a context leaks into another's sitemap, canonical URLs or
  cache.

## 2. Decisions already made

From the 2026-11-23 planning session with Tara. Not up for re-litigation
here.

- **Canonical context for auth is queeromaha.net.** `EMDASH_SITE_URL` is its
  origin; `/_emdash/*` lives only there.
- **The directory stays YAML in git.** It is bundled at build time, not
  moved into D1. Editing it is git-only, and that is fine for now. W9's
  spec recommended an Emdash collection (its decision 1); this reverses it
  to keep the cutover small. The move to a collection stays possible later
  because `src/lib/directory.ts` does not care where cards come from.
- **Events and posts are Emdash content**, so others can write and publish
  them. Events have recurrence presets and are scoped to contexts.
- **Newsletter is Buttondown**, through #46's provider adapter.
- **The .org intake (clothing requests) is a separate Worker with its own
  D1**, on `request.queeromaha.org`, outside this deployment. queeromaha.org
  itself is public and indexable; the intake is reached from a footer icon
  (section 5.2).
- **The site's legal entity is Tara personally**, with proxy contact details
  (email, phone, postal address). No home address appears anywhere.
- **Warrant canary and log purging apply to the whole family**, not only the
  intake. Same threat model.
- **Package manager is aube** for the consumer repo too, wired through
  voidflow (`site-ci.yml` with `package-manager: aube`).
- **Staging for the queeromaha.net cutover** is the Worker's own
  `workers.dev` hostname and per-PR Worker Previews. queeromaha.dev is no
  longer a staging host; it becomes the .dev context.
- **Workers Paid is acceptable**, though getting the bundle under the free
  limit is worth investigating (section 4.12).

## 3. Constraints found in the code

Checked against Emdash 1.0.1 (`emdash` on npm) and Cloudflare's docs on
2026-11-23.

- **Passkeys bind to one registrable domain.** Emdash's `allowedOrigins`
  (and `EMDASH_ALLOWED_ORIGINS`) must be `siteUrl`'s host or a subdomain of
  it (`src/auth/allowed-origins.ts`, "Rule B"). queeromaha.org cannot share
  queeromaha.net's passkeys. Hence one canonical admin host.
- **Emdash's sitemap and robots use one origin.** `/sitemap.xml`,
  `/sitemap-[collection].xml` and its `robots.txt` take `settings.url` or
  the public origin. Emdash skips injecting them when the site defines its
  own route (`hasUserDefinedPublicRoute`), so per-context versions are ours.
  voidsite already overrides `robots.txt`.
- **Emdash settings are single-valued.** Site title, tagline and logo exist
  once. Per-context naming comes from `site.config.ts`, not Emdash settings.
- **The Workers cache key ignores the host** (Cloudflare, "Cache keys": the
  cache belongs to the Worker, not to a domain). `Astro.cache` is not
  enabled in voidsite today (no cache provider configured), but the moment
  it is, `/` on .net and `/` on .org would collide. The context id must be
  in the key, or responses must not be shared-cached.
- **Emdash writes visitor data to D1.**
  - `_emdash_404_log`: path, referrer (512 chars) and user agent (256) for
    every miss, capped at 10,000 rows, no age limit. The middleware does not
    pass an IP today; the column exists.
  - `audit_logs`: `actor_ip` on plugin MCP tool calls (editors, not
    visitors), no age limit.
  - `_emdash_comments`: `ip_hash` and `user_agent`. Comments stay off.
  - D1 Time Travel keeps restore points for up to 30 days and cannot be
    turned off, so a purge is "gone from the live database now, gone from
    Cloudflare within 30 days". The privacy page must say so (the intake's
    already does).
- **Bundle size.** The Worker is about 16 MiB (4.1 MiB gzipped) per the
  README, over the free plan's 3 MiB gzip limit. What dominates has not been
  measured.
- **Route precedence.** A Worker route on a hostname takes precedence over a
  Custom Domain Worker on the same hostname (Cloudflare, "Routes"). Not used
  here: the intake has its own subdomain, so the two Workers never share an
  origin.

## 4. Design

### 4.1 Configuration

`site.config.ts` gains a `contexts` array. Top-level fields stay as the
defaults every context inherits; a context overrides only what differs.

```ts
contexts: [
    {
        id: 'net',
        host: 'queeromaha.net',
        /** The context that owns /_emdash and EMDASH_SITE_URL. Exactly one. */
        canonical: true,
        name: 'QueerOmaha',
        /** Label after the divider in the header lockup. */
        label: '.net',
        /** One line in the switcher list. */
        tagline: 'Directory and events',
        header: { wordmark: '/src/brand/queeromaha.svg', mark: '/mark.svg' },
        /** Emdash menu name for this context's nav. */
        menu: 'net',
        analytics: { posthog: true },
        indexable: true,
        /** Optional accent, a CSS color, exposed as --context-accent. */
        accent: '',
    },
    { id: 'org', host: 'queeromaha.org', label: '.org', /* ... */
      analytics: { posthog: false } },
    { id: 'dev', host: 'queeromaha.dev', label: '.dev', /* ... */ },
]
```

Rules, enforced by a unit-tested validator that runs in `astro check` and
CI:

- `id`s and `host`s are unique; exactly one context is `canonical`.
- The canonical context's host matches `EMDASH_SITE_URL`.
- Every `host` appears as a Custom Domain in `wrangler.jsonc` `routes`
  (and so in voidflow's token zones).
- `contexts` may be omitted: the site behaves as one context built from the
  top-level fields, so existing voidsite sites change nothing.

### 4.2 Resolving the context

- `src/lib/context.ts` (pure): `resolveContext(url, contexts, options)`
  returns the context for a hostname. Production hosts match `host`
  exactly, with `www.` redirected to the bare host.
- Middleware (`src/middleware.ts`, new) resolves once per request and puts
  it on `Astro.locals.context`. Layouts, routes and endpoints read it from
  there; nothing else looks at the hostname.
- **Unknown hosts** (the `workers.dev` hostname, Worker Previews,
  `localhost`) get the canonical context by default. To review another
  context there, `?context=<id>` selects it and sets a session cookie
  `voidsite-context-preview`. That cookie is **only ever set on non-production
  hosts**; a test asserts it never appears on a production host, so the
  privacy page does not change. The switcher on those hosts links to
  `?context=<id>` instead of to the other domain.
- **Admin on the canonical host only.** Any `/_emdash/*` request on a
  non-canonical production host gets a 308 to the same path on the
  canonical host. Editor sessions and passkeys therefore only exist there.

### 4.3 Header lockup and switcher

Extends `SiteHeader.astro` and `src/lib/header.ts`; the condense behavior
from #48 and the inline wordmark from #52 are unchanged.

Markup, left to right: `[mark][wordmark] | [label ▾]`.

- **Brand link** (mark plus wordmark) goes to `/`. When condensed, a plain
  click scrolls to the top instead (as today).
- **Divider**: a thin vertical rule, `aria-hidden`.
- **Switcher**: a `<details>`/`<summary>` whose summary shows the context
  label (`.net`) and a down chevron. The panel is a list of links, one per
  context, to that context's root, each with its tagline; the current one has
  `aria-current="page"` (when on its home) or `"true"`. Disclosure pattern,
  not an ARIA menu. Works with no JS. With JS, Escape and an outside click
  close it and return focus to the summary.
- Shown only when there are two or more contexts. The chevron is decorative;
  the summary's accessible name is "Switch site, current: queeromaha.net".
- **Condensed state** keeps the mark and the chevron: the wordmark, divider
  and label slide away, the chevron stays next to the mark. Tapping the mark
  scrolls to top; tapping the chevron opens the switcher. Opening the
  switcher while condensed does not expand the header.
- Hit targets at least 44 by 44 CSS px for the mark and the chevron. Focus
  rings visible in both themes.
- Motion only under `prefers-reduced-motion: no-preference`.
- Theme choice stays per origin (it is localStorage), so a visitor's
  explicit light/dark choice does not follow them across domains. Accepted;
  the default follows the browser.

### 4.4 Discovery files and head metadata, per context

All built from `Astro.locals.context`:

- `/sitemap.xml` and `/sitemap-[collection].xml`: voidsite routes replace
  Emdash's. They list only the entries visible in this context, with this
  context's origin, and only for `indexable` contexts.
- `robots.txt` (already ours): the context's `Sitemap:` line, and
  `Disallow: /` for a non-indexable context.
- `llms.txt`: context name, description and its sections.
- Canonical link, `og:url`, `og:site_name`, JSON-LD `WebSite` and
  `Organization`: per context. Each context's `Organization` gives the
  others in `sameAs`.
- Analytics: PostHog loads only where the context sets it. The privacy page
  lists per context what runs where; `legal.spec.ts` checks each context.
- Agent-legibility tests run per context (`paths.ts` gains a context
  dimension). A non-indexable context is exempt from the "no noindex" check;
  every indexable one is not.

### 4.5 Content scoping

- `posts`, `pages` and the new `events` collection get a `contexts`
  multi-select field (values: context ids). An entry shows in each context
  it names. Empty means the canonical context only.
- **One canonical URL per entry**: the first context in its list. In the
  other contexts it appears in lists and feeds but links to the canonical
  URL. No duplicate pages, no cross-domain duplicate-content problem.
- Routes filter by context. A slug requested on a context that does not
  include the entry 404s (or 308s to its canonical URL if it exists there;
  decided per collection, default 308).
- Menus: one Emdash menu per context, named by `menu`.
- Seeds apply once (roadmap section 3), so the `contexts` field ships in the
  seed for new sites and as an additive migration for existing ones. Context
  ids are slugs: never rename one.

### 4.6 Caching

- Any shared cache (Workers Cache API, `Astro.cache` once a provider is
  set) keys on context id plus path. A unit test on the key builder, and an
  e2e test that requests `/` on two contexts back to back and checks the
  titles differ.
- Until that exists, responses carry `Cache-Control: private` or a
  `Vary` that the cache honors. Never a shared cache keyed on path alone.

### 4.7 Directory (W9, YAML source)

- The consumer repo keeps `src/content/directory/*.yaml` (moved from
  queeromaha.net's `src/content/pages/*.yaml`, same item schema) and
  `categoryMap.json` / `tagMap.json`.
- A build-time loader (Astro content collection with the glob loader, as
  queeromaha.net does today) feeds `src/lib/directory.ts`. Rendering is
  on demand, not prerendered: prerendered files are served before the
  Worker runs, so `/art` would also answer on queeromaha.dev.
- The directory routes exist only in the `net` context; elsewhere they
  404.
- `.md` variants as a route variant on the same resolver (W9 3.3).
- Cutover: W3's `check:redirects` proves every queeromaha.net permalink and
  `.md` path returns 200 on the `workers.dev` host before DNS moves.

### 4.8 Events and calendars

- `events` collection: title, start, end or duration, `recurrence`, venue
  (free text, optional map link), description, url, `contexts`, and
  optional `directoryItem` (the YAML item's permalink slug, to link an event
  to its listing).
- `recurrence` is a select of presets that each write an RRULE: none,
  weekly on the start's weekday, every other week, monthly on the Nth
  weekday (computed from the start date, e.g. "2nd Thursday"), monthly on
  the last weekday, monthly on the same date. Plus "custom" with a raw RRULE
  field, validated on save. Editors never have to write RRULE by hand.
- YAML `recurring_events` on directory items keep working, merged with
  collection events.
- `ical.ts` and `eventsPreview.ts` port from queeromaha.net as pure modules.
- Feeds: `/events.ics` on each context lists that context's events; the
  canonical context also serves `/events-all.ics`. The footer calendar box
  (Google and Apple subscribe links) points at the context's own feed.

### 4.9 Newsletter: digest by publish

Builds on #46 (signup, provider adapter, Buttondown). Adds sending, with the
approval in Emdash so it does not depend on one person:

- `issues` collection: subject, intro (Portable Text), the generated list
  of posts and events, `contexts` (which contexts' content it covers).
- A weekly cron (voidsite already has a scheduled handler) creates a
  **draft** issue from posts published and events starting in the window,
  unless one already exists for that week.
- Any Emdash user with permission to publish `issues` reviews, edits and
  publishes it. A `content:afterPublish` hook for `issues` sends it through
  the provider (`NewsletterProvider.send()`, new in the adapter) and records
  the provider's email id on the entry, so a re-publish never sends twice.
- Handing off newsletter duty means granting someone the editor role. No
  Buttondown team seats.
- Open: whether Buttondown's email-sending API is on the plan chosen
  (subscriber creation is free; check before building `send()`).
- **Visitor IP not forwarded.** #46 sends the visitor's IP to Buttondown for
  its spam firewall. Under this family's threat model, make that a config
  flag (`newsletter.forwardIp`, default `false` here) and rely on Turnstile
  and the hashed-IP rate limit. The privacy copy follows the flag.
- Subscribers: email only, double opt-in (already #46's behavior), no names.

### 4.10 Privacy hardening, sitewide

- **Workers observability off** (`observability.enabled: false`) on the
  production Worker, as the intake does. Errors surface through voidlight's
  probes and CI smoke tests, not request logs.
- **Retention job** in the scheduled handler (`src/lib/retention.ts`, pure
  rules plus a thin D1 runner):
  - `_emdash_404_log`: delete rows whose `last_seen_at` is older than
    `retention.notFoundDays` (default 14; set to 30 for the first month
    after a cutover so W3's 404 watch has data, then back to 14). Null
    `user_agent` and `referrer` on rows not seen for a day; the path and hit
    count are what the 404 watch needs.
  - `audit_logs`: null `actor_ip` after 1 day, delete rows after 90 days.
  - Rate-limit KV entries already expire within the hour.
- **Kill switch**: `aube run purge:visitor-data` deletes the 404 log, audit
  IPs and newsletter signup rate-limit state, after typing a confirmation
  (same pattern as the intake's `purge:all`).
- **Warrant canary**: `src/lib/canary.ts` and `/canary` plus
  `/canary.txt` in every context, from one source. The text names the
  entity (Tara), a date, and a recent public headline, and is signed
  (minisign or an SSH signature, verifiable with a published key). CI fails
  if the canary is older than its stated interval, and voidlight probes
  `/canary.txt` and alerts (`notify` severity) when the date goes stale. The
  intake's canary (queeromaha.org PR #3) moves to the same source. Absence
  or staleness is the signal, so the automation matters more than the
  wording.
- **Mail domains stay apart**: Emdash sign-in links from the canonical
  domain through Cloudflare Email Sending; the newsletter from a subdomain
  through Buttondown (e.g. `news.queeromaha.net`); the intake keeps Resend
  on queeromaha.org with its own MX. No context's SPF or MX setup touches
  another's.
- `privacy.astro` and `site.config.ts` change in the same PR as each item,
  and `legal.spec.ts` covers each context, per the repo rule.

### 4.11 Deploy and CI

- `wrangler.jsonc`: one Custom Domain per context host. voidflow's
  `cf-tokens` derives zones from routes, so the deploy token covers all
  three zones without extra config.
- Previews: unchanged (separate D1, R2, KV). Contexts are reviewed with
  `?context=` (4.2).
- The intake Worker deploys from its own repo with its own token; the two
  share no bindings.

### 4.12 Bundle size (investigation)

Not a blocker. Measure before changing anything:

1. `wrangler deploy --dry-run --outdir dist-bundle` and a size breakdown of
   the output (`esbuild --metafile` or `source-map-explorer`).
2. Candidates to check, unverified: Emdash's WordPress importer (the GPL
   block parser comes in through it), the admin UI's React bundle, image
   tooling, duplicated dependencies.
3. If an import path can be dropped without forking Emdash, propose it
   upstream to Emdash rather than patching it here.

## 5. QueerOmaha contexts

The first consumer's shape, for the spec's tests and examples. Lives in the
consumer repo, not in voidsite.

### 5.1 Shared

- Header lockup with the existing asterisk mark and a QueerOmaha wordmark;
  per-context label and accent.
- Footer (from queeromaha.net's `SiteFooter`): suggestion box, calendar box
  with the context's feed, newsletter signup (#46 CTA), and the utility
  links (GitHub, privacy, contact, canary).

### 5.2 queeromaha.org: resources, and a footer door to the intake

- Indexable: resources pages and posts for the `org` context.
- **Intake entry point**: a small clothing icon in the footer of every
  `org` page, linking to `https://request.queeromaha.org/`, so it can be
  given out as "go to queeromaha.org and tap the clothes icon in the
  footer". The link:
  - has an accessible name ("Clothing requests") and a tooltip, so it is
    usable with a screen reader and by keyboard;
  - carries `rel="nofollow"`, and is left out of menus, the sitemap,
    `llms.txt` and JSON-LD;
  - is a plain link, so it works without JS.
- What "hidden" can and cannot mean: the intake origin answers
  `X-Robots-Tag: noindex` and a noindex meta on every response, so search
  engines and AI answer engines will not list it. Anyone parsing the HTML can
  still follow the link. That is fine: what protects requesters is the
  intake's own design (Turnstile, rate limits, no stored IPs, short
  retention, Access-gated admin), not the link's obscurity.
- The intake's robots.txt does **not** `Disallow` it: a disallowed page is
  never fetched, so its noindex is never seen, and a linked URL can still be
  listed. noindex is the control.

### 5.3 queeromaha.dev: builders and meetups

- **Members**: a curated YAML list in git of local queer and trans folks'
  sites and repos, shown as cards. It mirrors the existing webring
  (`webri.ng/webring/queeromaha`) and links back to it. Members do not need
  to use voidsite.
- **Status from voidlight**: voidlight probes each member site that opts in
  (it probes every 5 minutes, so it is opt-in per member), with a new
  `status-only` severity so a member's outage never pages Tara. .dev reads
  voidlight's `/status.json` server-side and shows up or down per card.
- **Repos**: a scheduled job fetches public metadata for listed GitHub
  repos (description, stars, last push) into KV; cards render from KV.
- **Meetups**: `events` with the `dev` context, and its own `.ics` feed.

### 5.4 queeromaha.net

- The directory (4.7), unchanged UX.
- Events from all contexts on the calendar box, with a combined feed.
- Canonical context: the admin lives here.

## 6. Slices

Each is its own PR, in order. Each lists what it needs.

1. **Contexts core**: config, validator, `resolveContext`, middleware,
   `?context=` on preview hosts, admin redirect. Needs nothing.
2. **Header switcher**: lockup, condensed chevron, `<details>` fallback.
   Needs 1.
3. **Per-context discovery**: sitemap, robots, `llms.txt`, canonical, JSON-LD,
   per-context analytics and legal copy. Needs 1.
4. **Content scoping**: `contexts` field, route filtering, canonical rules,
   per-context menus. Needs 1.
5. **Cache key**: context-aware keys and the collision test. Needs 1; must
   land before any shared cache is turned on.
6. **Privacy hardening**: observability off, retention job, purge script,
   canary. Needs nothing; can run in parallel with 1-5.
7. **Directory YAML source and routes** (W9 remainder). Needs 1 and 4.
8. **Events and calendars**. Needs 4.
9. **Newsletter digest by publish**. Needs #46 and 8.
10. **Bundle size investigation**. Independent.

Consumer side (QueerOmaha repo, after 1-7): scaffold from voidsite, port
content and styles, `check:redirects` against `workers.dev`, then move
queeromaha.net DNS. .org and .dev contexts follow.

## 7. Tests

- Unit: `resolveContext` (exact host, `www.`, unknown host, preview
  override), config validator, sitemap builder per context, canonical-URL
  rules, cache key builder, recurrence presets to RRULE, digest builder,
  retention rules, canary staleness.
- e2e (Playwright, per context through a host override): header lockup and
  switcher (mouse, keyboard, no-JS, condensed), discovery files, analytics
  presence per context, preview cookie never set on a production host,
  cross-context cache collision, footer intake link attributes on `org`.
- a11y: axe on every page in every context, both color schemes.

## 8. Open questions

1. Buttondown's send API on the chosen plan (4.9).
2. Whether member sites on .dev should show uptime history or only current
   status. Current only is simpler and kinder to members.
3. Accent colors per context: one per TLD, or none. Cosmetic; decide at
   the header mock-up.
4. How the consumer repo pulls voidsite updates (roadmap section 5,
   "Template update propagation"). Upstream remote is the current lean.
