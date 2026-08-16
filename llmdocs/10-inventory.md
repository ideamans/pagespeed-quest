# The inventory — what you edit

The inventory is the reverse-engineered page. Everything the browser will
receive during playback comes from here, and nothing else does.

```
inventory/
├── index.json                     ← the resource list. THIS is what the proxy reads
└── contents/
    └── GET/
        └── https/
            └── example.com/
                ├── index.html
                ├── assets/app.css
                ├── assets/app.js
                └── img/hero.jpg
```

- **`index.json` is authoritative.** The playback proxy reads exactly that file
  name. If a file called `inventory.json` also exists (older recordings wrote
  both names), `psq` will read *that* one for the entry URL, device type and
  traffic figures while the proxy serves from `index.json` — the two silently
  disagree. Delete `inventory.json`, or keep it byte-identical.
- **`contents/` holds one file per response body.** Text bodies are stored
  decoded, converted to UTF-8 and pretty-printed, so they are diffable and
  editable by hand.

## How a URL becomes a path

`contents/<METHOD>/<protocol>/<host>/<pathname>`

| URL | File |
| --- | --- |
| `https://example.com/` | `contents/GET/https/example.com/index.html` |
| `https://example.com/assets/app.css` | `contents/GET/https/example.com/assets/app.css` |
| `https://example.com/api?id=1` | `contents/GET/https/example.com/api~id=1` |
| `https://cdn.example.com:8443/a.js` | `contents/GET/https/cdn.example.com~8443/a.js` |

Rules: a trailing `/` (or a path with no extension) gets `index.html`; the query
string is appended after `~`; a colon in the host becomes `~`; an over-long
basename is truncated and suffixed with a short SHA-1. Do not rename these files
by hand — the mapping comes from `contentFilePath` in `index.json`, and the file
name is only a convenience.

## `index.json`

```json
{
  "entryUrl": "https://example.com/",
  "deviceType": "mobile",
  "resources": [ ... ]
}
```

`entryUrl` and `deviceType` are what `playback` uses instead of asking you for a
URL. Changing `deviceType` here changes the Lighthouse form factor and the
loadshow preset on the next playback — it does **not** re-record.

### A resource

| Field | Effect at playback time |
| --- | --- |
| `method`, `url` | how the request is matched. A request that matches nothing gets a 404 |
| `ttfbMs` | **the proxy sleeps this long after receiving the request, before the first byte.** Per request, not an offset from page start |
| `durationMs` | recorded transfer duration. Informational; playback derives its own from size and `mbps` |
| `mbps` | transfer speed for the body. Missing → 1.0 Mbps |
| `statusCode` | the status served |
| `rawHeaders` | headers served, minus `content-length` and `content-encoding`, which are recomputed |
| `contentEncoding` | `gzip` / `br` / `deflate` / `zstd` / `compress` / `identity`. The body is **re-compressed with this before it goes on the wire**, so it decides the transferred size |
| `contentTypeMime`, `contentCharset` | the `Content-Type` served. `contentCharset` re-encodes the body from UTF-8 on the way out |
| `contentFilePath` | the file under `contents/` to serve |
| `contentUtf8` / `contentBase64` | inline body, used instead of the file when present |
| `minify` | `true` → the body is **re-minified before serving**. Set during recording when the original was minified |
| `httpVersion` | protocol version reported for the response |

### The timing model, precisely

```
response time ≈ ttfbMs  +  (bytes on the wire × 8) / (mbps × 1,000,000)
```

- `ttfbMs` is a fixed per-request delay. It models server think time plus
  connection latency. Lower it to model a faster origin or a nearer CDN edge.
- The second term is recomputed **from the bytes you leave in the file**, after
  minification and after `contentEncoding` compression. So shrinking a file
  makes it arrive sooner, automatically, with no other edit.
- `--full-throttle` (used internally by `psq capture`) skips both. Never compare
  a full-throttle run with a normal one.

### Two traps worth stating plainly

**`minify: true` re-minifies your edit.** The pretty-printed file in `contents/`
is for you; the wire sees the minified form. This keeps the byte count honest —
the original site shipped minified bytes — but it means whitespace edits have no
size effect, and it means a syntax error introduced during editing can surface
as a minifier failure rather than a browser error.

**`contentEncoding` decides the transferred size, not the file size.** A 300 KB
JavaScript file with `"contentEncoding": "br"` is perhaps 60 KB on the wire, and
that 60 KB is what the timing is computed from. To model "we turned compression
off", set it to `identity`; to model "we finally enabled Brotli", set it to
`br`. Do not edit `content-length` — it is recomputed and your value is
discarded.

## Editing safely

1. Copy `inventory/` to `baseline/` before the first edit.
2. Change **one thing at a time**, then measure. Two edits in one run means you
   cannot attribute the delta.
3. After a structural edit (removing a script, changing a URL), run
   `psq capture --compare` and look at the picture. A faster broken page is easy
   to produce and easy to mistake for a win.
4. Keep the inventory in version control if the quest lasts more than a day.
   `git diff` over `contents/` is a readable record of the hypothesis.

## Live editing with a browser

```sh
psq proxy -p 8080
```

serves the inventory and **watches it**: any change under `inventory/` restarts
the proxy, so a browser pointed at `http://localhost:8080` picks up your edit on
the next reload. The proxy uses a dummy certificate, so the browser has to be
told to accept it:

```sh
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --ignore-certificate-errors --proxy-server=http://localhost:8080
```

This is the fastest way to iterate on markup edits before spending a Lighthouse
run on them.
