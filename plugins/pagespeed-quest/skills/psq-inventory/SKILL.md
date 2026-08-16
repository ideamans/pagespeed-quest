---
name: psq-inventory
description: Edit a PageSpeed Quest recording — the reverse-engineered copy of a web page held in the inventory directory — to model a front-end optimization. Use when you need to know where a recorded page's HTML, CSS, JavaScript or images live on disk, what each field of index.json does at playback time, or which concrete edit simulates deferring a script, compressing an image, enabling Brotli, or a faster server response.
license: GPL-3.0-or-later
compatibility: Requires an existing PageSpeed Quest recording (an inventory directory produced by `psq lighthouse recording` or `psq loadshow recording`). Editing is plain file editing — no psq invocation is needed until you measure.
allowed-tools: Bash(npx:*) Bash(cp:*) Bash(ls:*) Bash(cat:*) Bash(du:*) Bash(find:*) Bash(jq:*) Bash(cwebp:*) Bash(magick:*) Bash(convert:*) Read Write Edit Glob Grep
---

# psq-inventory

The inventory is the page, reverse-engineered into files you can edit. This
skill is about **what to change and what happens when you do**.

Run `npx psq llm` for the authoritative version of everything below — it ships
with the installed package and cannot drift from it.

## Layout

```
inventory/
├── index.json          ← the resource list. The playback proxy reads THIS file
└── contents/
    └── GET/https/example.com/
        ├── index.html
        ├── assets/app.css
        ├── assets/app.js
        └── img/hero.jpg
```

`contents/<METHOD>/<protocol>/<host>/<pathname>`. A trailing `/` becomes
`index.html`; a query string is appended after `~`; a colon in the host becomes
`~`; very long names are truncated with a SHA-1 suffix. The authoritative
mapping is each resource's `contentFilePath` — read it from `index.json` rather
than guessing:

```bash
jq -r '.resources[] | [.url, .contentFilePath] | @tsv' inventory/index.json
```

HTML, CSS and JavaScript are stored decoded, converted to UTF-8 and
pretty-printed, so they diff and edit cleanly.

If a file named `inventory.json` also exists (older recordings wrote both
names), delete it or keep it identical to `index.json` — `psq` reads that one
for the entry URL and traffic stats while the proxy serves from `index.json`.

## What each field does at playback

| Field | Effect |
| --- | --- |
| `url`, `method` | request matching. No match → **404**, not "no request" |
| `ttfbMs` | the proxy sleeps this long after the request arrives, before the first byte. Per request, not an offset from page start |
| `mbps` | body transfer speed. Missing → 1.0 Mbps |
| `contentEncoding` | `gzip`/`br`/`deflate`/`zstd`/`identity`. The body is re-compressed with this, so it decides the **transferred** size |
| `contentTypeMime`, `contentCharset` | the `Content-Type` served |
| `contentFilePath` | which file under `contents/` is served |
| `minify` | `true` → the body is **re-minified before serving** |
| `rawHeaders` | headers served. `content-length` and `content-encoding` are recomputed and yours are ignored |
| `statusCode` | the status served |

```
response time ≈ ttfbMs + (bytes on the wire × 8) / (mbps × 1,000,000)
```

Wire bytes are counted **after** minification and compression. So shrinking a
file speeds it up automatically — no other edit needed.

## Before editing

```bash
cp -r inventory baseline
```

Then change one thing, measure, and either keep or revert it.

## Recipes

### Content edits (edit the file under `contents/`)

| Hypothesis | Edit | Expect |
| --- | --- | --- |
| the hero image is too heavy | re-encode/resize the file in place; set `contentTypeMime` and the `content-type` header if the format changed | LCP, SI, transfer |
| below-the-fold images should be lazy | add `loading="lazy"` in the HTML | FCP, SI |
| the LCP image should be preloaded | add `<link rel="preload" as="image" fetchpriority="high">` | LCP (bounded by that resource's `ttfbMs`) |
| this script is render-blocking | add `defer` or `async` in the HTML | FCP, LCP, SI, often TBT |
| this third-party tag is expensive | delete the `<script>` tag; optionally then delete the resource entry | TBT above all |
| the bundle is bloated | replace the file with a smaller build | TBT and main-thread time move **for real** — the browser executes what you serve |
| critical CSS should be inlined | add a `<style>` block, defer the stylesheet link | FCP, LCP, SI — watch CLS |
| fonts block text | `font-display: swap` in the CSS, and/or preload the font | FCP, LCP; CLS if it reflows |
| images cause layout shift | add `width`/`height` or `aspect-ratio` | CLS (weight 0.25 — cheap and disproportionate) |

### Metadata edits (edit `index.json`)

| Hypothesis | Edit | Expect |
| --- | --- | --- |
| "what if the server were faster?" | lower `ttfbMs` on the document | everything downstream, roughly one-for-one. Run early: it separates back-end budget from front-end budget |
| "what if it were on a CDN / a faster link?" | raise `mbps` on that host's resources (apply per host, not per file) | transfer time |
| "what if compression were enabled?" | set `contentEncoding` to `br` on text resources that had `identity` | transfer time. The reverse quantifies what compression already buys |
| "what if there were fewer requests?" | concatenate files, update the reference, delete the extra entry | mostly the removed `ttfbMs` |
| model a different form factor | change `deviceType` | Lighthouse form factor and loadshow preset on the next playback — it does not re-record |

## Two traps

**`minify: true` re-minifies your edit.** The pretty-printed file is for you;
the wire sees minified bytes. Whitespace edits have no size effect, and a syntax
error can surface as a minifier failure rather than a browser error.

**Deleting a resource entry produces a 404, not silence.** Remove the reference
from the HTML in the same edit, or the browser records a failed request and the
measurement is worse than the truth.

## After a structural edit

```bash
npx psq -i ./baseline capture -a ./artifacts-baseline
npx psq capture --compare ./artifacts-baseline/capture.png
```

and look at `artifacts/capture-diff.png`. A faster broken page is easy to
produce and invisible in the score.

## What cannot be modelled

Caching across page views (every playback is cold), HTTP/2 prioritisation and
connection contention, server-side changes to the HTML beyond what you hand-edit,
and anything after the load (interaction, INP). Say so when reporting.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| the edit has no visible effect | the wrong file was edited | resolve the path via `contentFilePath` in `index.json`, not by guessing from the URL |
| transfer size unchanged after a big edit | `minify: true`, or `contentEncoding` compresses the change away | compare the *Traffic* line, not *Resource*, in `summary.md` |
| a request now fails | the resource entry was deleted but the HTML still references it | remove the reference, or restore the entry |
| the proxy serves stale content | the playback proxy caches the inventory at start | `psq proxy` restarts on change; other subcommands re-read on each run |
| JSON edits are ignored | `inventory.json` exists alongside `index.json` and the two disagree | delete `inventory.json` |
| `content-length` edits do nothing | it is recomputed from the served bytes | change the bytes, not the header |
| everything got slower after editing several things | multiple edits in one measurement | one edit per measurement; revert and redo |
