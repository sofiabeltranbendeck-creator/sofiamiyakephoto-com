# SofiaMiyakephoto.com

Static HTML/CSS/JS for a documentary photographer in Roseville, CA. No build step. Netlify serves the
publish directory directly.

## Image filenames: the pre-merge gate

**No PR merges until every image it adds or touches is named for search.** This is a blocking check, not a
nice-to-have. Camera IDs (`DSC09951.jpg`) tell Google nothing; a descriptive filename is a real, if modest,
ranking signal for Google Images, and Images is a meaningful discovery surface for a photographer.

**The format**, in order:

```
<place>-<subject>-<qualifier>.jpg
roseville-family-session-golden-hour.jpg
sacramento-wedding-ceremony-first-kiss.jpg
rocklin-senior-portrait-cap-and-gown.jpg
```

- **Lowercase, hyphen-separated.** Google parses hyphens as word breaks; it does not reliably split
  `RosevilleFamilyShot`. Never use underscores, spaces, camelCase or `%20`.
- **Place first** where the photo has one — Roseville, Rocklin, Sacramento, Granite Bay, Lincoln, Folsom.
  Local intent is what this business competes on.
- **Describe the photograph, not the keyword you want.** `roseville-family-session-golden-hour.jpg` is
  descriptive. `best-roseville-photographer-cheap.jpg` is stuffing, and repeating one stem across dozens of
  files reads as stuffing too, even when each name is individually fine.
- **Three to six words.** Long enough to be specific, short enough to stay readable.
- **Derive it from the alt text**, which on this site is already written properly. If the alt text says
  "A father lifting his toddler against the last of the light", the filename is
  `roseville-father-lifting-toddler-golden-hour.jpg`. If the two disagree, the alt text is right.
- **No sequence numbers as the whole name.** `-2` as a disambiguator is fine; `img-2.jpg` is not.

**When renaming an existing image, the rename is not done until all five of these are updated:**

1. Every `src` and `srcset` candidate in HTML, including the `/.netlify/images?url=…` CDN URLs.
2. Inline `style="background-image:url(…)"` and any `data-bg` attribute.
3. `css/style.css` background URLs.
4. `og:image` tags, and any absolute URL inside JSON-LD (`logo`, `image`).
5. `sitemap.xml` — both `<loc>` and every `<image:loc>`.

Then add a `301!` line to `_redirects` for the old path, so links and crawled URLs keep working:

```
/images/DSC09951-hero.jpg  /images/roseville-family-golden-hour-hero.jpg  301!
```

Verify with a case-sensitive resolve of every reference against the files on disk before opening the PR.
`tools/dev-server.mjs` is case-sensitive and will surface a miss that Windows and Netlify both hide.

**Alt text still matters more than the filename.** Never weaken alt text to make a filename look tidier.

## Every multi-package workflow ends with a change-review dashboard

**Required, not optional.** Any time a workflow touches more than a couple of files, finish by writing
`.work/change-review.html` — a single tabbed page with one tab per work package, plus tabs for per-page
before/after numbers, the deploy gates and the open questions.

- **One tab per change.** Each tab states what changed, what was declined and why, and shows real
  before/after text for anything rewritten. A summary that omits the actual filenames, line numbers or
  snippets is not usable.
- **Real measured numbers only**, from one strip rule applied to both the working tree and `git HEAD`.
  Never restate a number from a brief without measuring it first — briefs for this project have a track
  record of being wrong.
- **Lead with what needs the owner.** Blocking decisions go above the accomplishments.
- Publish it as an Artifact for a shareable link and keep the file at `.work/change-review.html`.
  `.work/` is blocked from being served, so it never ships.

## Previewing locally

`node tools/dev-server.mjs 8787`. **Do not use `python -m http.server`** — it gets three things wrong that
make the site look broken when it is not:

| | plain static server | `tools/dev-server.mjs` |
|---|---|---|
| `/.netlify/images?url=…` | 404 — **every photo appears broken**, because browsers prefer a srcset candidate over `src` | serves the original file |
| Clean URLs (`/weddings`) | 404 — **every in-body link is broken** | resolves to `weddings.html` |
| Working docs | serves `.md`, `/tools/*`, `/.work/*` | 404s them, as `_redirects` does |

A caveat when checking visually: `IntersectionObserver` (the `.reveal` animations) and `loading="lazy"` only
run while the page is actually painting. If the window is behind another window the pane stops drawing and
both stall — images report `naturalWidth 0` and reveal blocks stay at `opacity: 0`. That looks exactly like a
broken page and is not one. Verify asset health with HTTP status codes, which do not depend on painting.

## Repo and production are in sync — verify, don't assume

As of 5 Oct 2026, after PR #1, `origin/main` and production are byte-identical (verified by diffing a live
`curl` of `/` against `index.html`, and by `git diff` against the merged tip). This repo used to diverge from
production in both directions; it no longer does.

Production deploys from Sofia's GitHub repo (`sofiabeltranbendeck-creator`) via her Netlify account. Before
relying on repo state for anything user-facing, confirm with one live fetch.

## Netlify serves assets case-INsensitively

An earlier version of this file claimed Netlify is case-sensitive and that a filename-case mismatch 404s the
photo. **That is wrong.** Measured 5 Oct 2026 — all four of these returned `200` with an identical
316,535 bytes:

```
/images/DSC09951-hero.jpg   /images/dsc09951-hero.jpg
/images/DSC09951-HERO.jpg   /images/dSc09951-HeRo.jpg
```

The real consequence runs the other way: **a case bug is invisible in production here**, so testing the live
site cannot catch one. It would only surface on a move to a case-sensitive host. Keep case consistent as
hygiene — the tree currently has zero mismatches — but do not treat it as an emergency, and do not let a
"case fix" script loose on the repo without reading what it actually changes.

Two filenames are not a plain uppercase transform: `DSC09481-2-Edit.jpg` and `DSC09492-Edit.jpg` carry a
capital E. Renames on this filesystem need a two-step hop through a `tmp-` name.

Any script that walks the HTML must include the three pages under `recent-shoots/`, which reference images
nothing else does:

```js
const files=[...fs.readdirSync(".").filter(f=>f.endsWith(".html")),
  ...fs.readdirSync("recent-shoots").filter(f=>f.endsWith(".html")).map(f=>"recent-shoots/"+f)];
```

## Images are optimised by the Netlify Image CDN, not by static WebP

Every `<img>` pairs a `/.netlify/images?url=…&w=…` srcset ladder with the raw file as the `src` fallback.
The CDN resizes **and** negotiates WebP from the `Accept` header with no `fm=webp` in the URL — measured
316,535 B original → 21,786 B WebP at `w=640`.

**Do not add `<picture>` elements or commit static `.webp` files.** That duplicates work the platform already
does per request, at the right size, and ships bytes nobody downloads.

Background images need the CDN URL written in by hand — they have no srcset to fall back on. Check
`data-bg` attributes and `style="background-image:…"` whenever a background photo is added.

## Internal working notes never ship

**This repository is public.** Working notes, audits, strategy and pricing questions stay out of it
entirely — they are gitignored, not just unlinked. Two separate things have to be true for each one:

1. It is in `.gitignore`, so it never reaches GitHub.
2. It has a `/NAME.md /404.html 404!` line in `_redirects`, so it is not served if it is ever uploaded
   as part of the publish directory.

Questions for Sofia go in `FOR-SOFIA.md` (gitignored). **They never go in HTML comments.** A batch of
`TODO(sofia)` notes was readable in the live page source until 5 Oct 2026 because comments in the
publish directory ship to every visitor. An HTML comment is not a private channel.
