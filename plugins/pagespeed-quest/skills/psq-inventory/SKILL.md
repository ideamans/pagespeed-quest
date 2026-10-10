---
name: psq-inventory
description: Edit a PageSpeed Quest recording — the reverse-engineered copy of a web page held in an inventory directory — so that a replay reflects a change you want to test. Use when you need to know where a recorded page's HTML, CSS, JavaScript or images live on disk, what each field of index.json does at playback time, how an edit to a file or to the timing metadata changes the replay, or why an edit had no effect.
license: GPL-3.0-or-later
compatibility: Requires an existing PageSpeed Quest recording (an inventory directory produced by psq-record). Editing is plain file editing — no psq invocation is needed until you measure.
allowed-tools: Bash(npx:*) Bash(cp:*) Bash(rm:*) Bash(ls:*) Bash(cat:*) Bash(du:*) Bash(find:*) Bash(diff:*) Bash(jq:*) Bash(cwebp:*) Bash(magick:*) Bash(convert:*) Read Write Edit Glob Grep
---

# psq-inventory

The inventory is the page, reverse-engineered into files you can edit. The
playback proxy serves exactly what is in it, with the timing recorded in it.
This skill covers **how an edit reaches the replay** — what to change is your
call.

Run `npx psq llm` for the authoritative version of everything below — it ships
with the installed package and cannot drift from it.

## Layout

```
inventory/
├── index.json          ← the resource list. The playback proxy reads THIS file
├── originals/          ← the recorded wire bytes of reformatted bodies. Never edit
└── contents/
    └── get/https/example.com/
        ├── index.html
        ├── assets/app.css
        ├── assets/app.js
        └── img/hero.jpg
```

`contents/<method, lower-case>/<protocol>/<host>/<path>`. A trailing `/`
becomes `index.html`; a query string is URL-encoded and inserted after `~`
before the extension, and a long one is cut and suffixed with a SHA-1. Do not
guess — every resource's `contentFilePath` (relative to the inventory directory)
is the authoritative mapping:

```bash
jq -r '.resources[] | [.url, .contentFilePath] | @tsv' inventory/index.json
```

Text bodies are stored decoded and converted to UTF-8. Minified CSS and
JavaScript are also pretty-printed (and marked `minify: true`); HTML is kept as
recorded.

If a file named `inventory.json` also exists (older recordings wrote both
names), delete it — `psq` reads that one for the entry URL and traffic stats
while the proxy serves from `index.json`.

## What each field does at playback

| Field | Effect |
| --- | --- |
| `url`, `method` | request matching. No match → **404**, not "no request" |
| `ttfbMs` | the proxy sleeps this long after the request arrives, before the first byte. Per request, not an offset from page start |
| `mbps` | body transfer speed, measured at recording. Used only for an edited body (see below). Missing → the median of the same host |
| `contentEncoding` | `gzip`/`br`/`deflate`/`zstd`/`identity`. The body is re-compressed with this, so it decides the **transferred** size |
| `contentTypeMime`, `contentCharset` | the `Content-Type` served; the body is re-encoded from UTF-8 to `contentCharset` |
| `contentFilePath` | which file is served |
| `contentUtf8` / `contentBase64` | an inline body, used only when there is no `contentFilePath`. Recordings do not write it |
| `minify` | `true` → the body is **re-minified before serving** |
| `rawHeaders` | headers served. `content-length` and `content-encoding` are recomputed and yours are ignored |
| `original` | written by the recorder: where the recorded wire bytes are and a hash of the file. **Do not edit** — it is how playback tells an unedited body from an edited one |
| `statusCode` | the status served |
| `deviceType` (top level) | Lighthouse form factor and loadshow preset for every playback. Changing it does not re-record |
| `formatVersion` (top level) | `2` for recordings made with psq 0.12 or later. Without it, the older timing below applies |

```
unedited body:  the recorded bytes, in the recorded time (ttfbMs + recorded transfer)
edited body:    ttfbMs + (bytes on the wire × 8) / (mbps × 1,000,000)
```

A body counts as edited when its file, `contentEncoding`, `contentCharset` or
`minify` differs from the recording. Wire bytes are counted **after**
minification and compression, so shrinking a file makes it arrive sooner — no
other edit needed — and the browser really executes and renders what you serve,
so CPU-side effects of an edit are measured, not estimated.

**Recordings without `formatVersion: 2`** (made with psq before 0.12) replay
every body in its recorded `durationMs`, whatever its size: shrinking a file
does not make it faster. Check with `jq .formatVersion inventory/index.json`,
and re-record if it is `null`.

## Two kinds of edit

**Content edits** change a file under `contents/`: the HTML, a stylesheet, a
script, an image. Anything a front-end change could do to the bytes the browser
receives can be modelled this way.

**Metadata edits** change `index.json`, and model what the front-end cannot:

| To model | Edit |
| --- | --- |
| a faster or slower server / origin | `ttfbMs` on that resource (the document first) |
| a faster or slower link, a CDN | `mbps` on every resource of that host — per host, not per file |
| compression switched on or off | `contentEncoding` on the text resources |
| a different form factor | top-level `deviceType` |
| a resource that is no longer requested | remove the reference from the HTML **and** the entry |

## psq-specific rules when editing

- **Changing an image's format**: replace the bytes at the same path, then set
  `contentTypeMime` and the `content-type` in `rawHeaders` to the new type. The
  URL can keep its old extension — browsers go by `Content-Type`.
- **Adding a new resource** (a split-out file, a new font): add an entry to
  `resources`. `method`, `url` and `ttfbMs` are required — an entry without
  them makes the whole `index.json` unreadable. Also set `statusCode`,
  `contentTypeMime` and `contentFilePath`, and copy `ttfbMs` / `mbps` from a
  comparable resource on the same host so the timing is not invented. Create
  the file at that path.
- **Removing a resource**: delete the reference in the HTML in the same edit.
  An entry deleted while still referenced is a failed request, not an absent
  one, and makes the result look worse than the truth.
- **A request the browser makes that was not recorded** (a new URL your edit
  introduced) gets a 404. Add an entry for it.
- **`minify: true` re-minifies your edit.** Whitespace changes have no size
  effect, and a syntax error can surface as a minifier failure.
- **`ttfbMs` stays fixed** whatever you do to the content. A preloaded or
  reprioritised resource still waits its recorded `ttfbMs`.
- Do not edit `content-length` — it is recomputed.

## Keep edits attributable

Edit the working `inventory/`, never `baseline/`. Change one thing per
measurement; reset the working copy before the next one (the loop is in
**psq-usage**). Record what you changed:

```bash
diff -ru accepted inventory > trials/t03-defer-gtm.diff
```

## Check the edit by eye before spending a measurement

```bash
npx psq proxy -p 8080
```

serves the working inventory and restarts on any change under it. Point a
browser at it with certificate checks disabled and reload after each edit:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --ignore-certificate-errors --proxy-server=http://localhost:8080
```

After a structural edit, also run the screenshot comparison in **psq-measure**.

## What cannot be modelled

Caching across page views (every playback is cold), HTTP/2 prioritisation and
connection contention, server-side changes to the HTML beyond what you hand-edit,
and anything after the load (interaction, INP). Say so when reporting.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| the edit has no visible effect | the wrong file was edited | resolve the path via `contentFilePath` in `index.json`, not by guessing from the URL |
| a smaller file loads no faster | the recording predates `formatVersion: 2` and replays the recorded duration | re-record with psq 0.12 or later |
| an unedited resource is served differently from the recording | `original` or the files under `originals/` were edited or deleted | restore them from `baseline/` |
| transfer size unchanged after a big edit | `minify: true`, or `contentEncoding` compresses the change away | compare the *Traffic* line, not *Resource*, in `summary.md` |
| a request now fails | the entry was deleted but the HTML still references it, or the edit introduced a URL that was never recorded | remove the reference, or add an entry |
| an image no longer shows | format changed but `contentTypeMime` / `content-type` still names the old one | update both |
| the proxy serves stale content | the playback proxy reads the inventory at start | `psq proxy` restarts on change; `lighthouse playback` re-reads on each run |
| JSON edits are ignored | `inventory.json` exists alongside `index.json` and the two disagree | delete `inventory.json` |
| `content-length` edits do nothing | it is recomputed from the served bytes | change the bytes, not the header |
| the baseline changed | an edit was made under `baseline/` | re-record; the baseline must stay as recorded |
