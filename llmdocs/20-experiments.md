# Experiments — which edit models which optimization

Each recipe is: the hypothesis, the exact edit, what should move, and what to
watch out for. Make one edit, measure, record the delta, revert or keep. The
metric names are the Lighthouse ones reported in `artifacts/summary.md`
(LCP ×0.25, CLS ×0.25, TBT ×0.30, FCP ×0.10, SI ×0.10).

Paths below are relative to the inventory directory.

## Images

### Compress or re-encode an image

**Hypothesis** "the hero image is far heavier than it needs to be."

Replace the file in place, keeping the same path:

```sh
cwebp -q 75 contents/GET/https/example.com/img/hero.jpg \
  -o contents/GET/https/example.com/img/hero.jpg
```

Then, in `index.json`, set the served type to match the new bytes:

```json
{ "contentTypeMime": "image/webp", "rawHeaders": { "content-type": "image/webp" } }
```

**Moves** LCP, SI, and total transfer. Transfer time falls in proportion to the
byte count at the recorded `mbps`.

**Watch out** The URL still ends in `.jpg`; that is fine, browsers go by
`Content-Type`. Do not touch `content-length`. If the format is not supported by
the recorded device profile the image simply fails to decode — check
`psq capture`.

### Serve a correctly sized image

Same edit, but resize rather than re-encode. This is usually the larger win on
mobile recordings, because the recorded page often ships a desktop-sized asset.
Compare `summary.md`'s image traffic line before and after.

### Lazy-load below-the-fold images

Edit the document: add `loading="lazy"` to `<img>` elements below the fold.

**Moves** FCP and SI, sometimes LCP indirectly (bandwidth freed for the hero).
Nothing needs to change in `index.json` — the lazily-loaded requests simply do
not happen during the measured window.

### Preload the LCP image

```html
<link rel="preload" as="image" href="/img/hero.webp" fetchpriority="high">
```

in `<head>`. **Moves** LCP. **Watch out** the recorded `ttfbMs` of that resource
still applies as a fixed delay, so the win is bounded by it.

## Scripts

### Defer or async a render-blocking script

Edit the document, add `defer` (order preserved) or `async` (order not).

**Moves** FCP, LCP, SI. TBT often moves too, because the work lands after the
first paint.

### Remove a third-party tag

Delete the `<script>` from the document. Optionally also delete the resource
from `index.json` — but only after the reference is gone, or the browser will
record a failed request (see the 404 rule).

**Moves** TBT most visibly, plus whatever the tag was blocking. This is the
single most informative experiment on most commercial pages: it puts a number on
"what is the tag manager costing us".

**Watch out** Some tags inject further requests. Removing the parent removes
those too, which is realistic — but it makes the delta larger than the tag's own
weight, so say so when reporting.

### Shrink the bundle

Replace the file under `contents/` with a smaller build (drop a polyfill, remove
a library, run a real minifier). Because the browser actually executes what you
serve, **TBT and main-thread time respond for real** — this is not a simulated
number.

## CSS and fonts

### Inline critical CSS, defer the rest

In the document, add a `<style>` block with the above-the-fold rules and switch
the stylesheet link to a deferred load:

```html
<link rel="preload" href="/assets/app.css" as="style" onload="this.rel='stylesheet'">
```

**Moves** FCP, LCP, SI. **Watch out** CLS often gets *worse* if the inlined
subset is incomplete — check `psq capture --compare` as well as the score.

### Remove unused CSS

Edit the stylesheet under `contents/`. Remember `minify: true` re-minifies, so
the win shows up as fewer bytes, not as tidier formatting.

### `font-display: swap` and font preloading

Edit the `@font-face` block in the stylesheet, and/or add
`<link rel="preload" as="font" crossorigin>` to the document.

**Moves** FCP and LCP when text was the largest element; CLS if the swap causes
reflow. Subsetting the font file itself is the transfer-size half of the same
experiment.

## Network and server

These are the levers that do not exist in a normal development environment, and
they are the reason for the `index.json` fields.

### "What if the server responded faster?"

Lower `ttfbMs` on the document resource (often 200–800 ms on a real recording):

```json
{ "url": "https://example.com/", "ttfbMs": 80 }
```

**Moves** everything downstream, roughly one-for-one. Run this early — it tells
you how much of the budget is back-end and therefore *not* fixable in the
front-end.

### "What if we put it on a CDN / on a faster link?"

Raise `mbps` on the resources served from the slow host. To model a slower
network instead, lower it. Apply it to a whole host, not a single file, or the
result will not resemble anything real.

### "What if we finally enabled compression?"

Set `contentEncoding` to `br` (or `gzip`) on the text resources that had
`identity`. The proxy re-compresses and the transfer time follows.

The reverse — setting `identity` on everything — quantifies what compression is
already buying you, which is a useful number when someone proposes turning it
off for CPU reasons.

### "What if there were fewer requests?"

Concatenate two files into one under `contents/`, update the document to
reference the survivor, and delete the other entry from `index.json`. The win
here is mostly the removed `ttfbMs`, so it is only worth it where that value is
large.

## Layout stability

### Reserve space for images and embeds

Add `width` / `height` (or an `aspect-ratio` rule) in the document or the
stylesheet. **Moves** CLS, which carries the same weight as LCP — a cheap edit
with a disproportionate score effect.

## What this cannot model

State these plainly when reporting results.

- **Caching across page views.** Every playback is a cold load.
- **HTTP/2 prioritisation and connection contention.** Each host is served by
  its own local server; the real contention on a shared connection is not
  reproduced.
- **Server-side changes that alter the HTML.** You can hand-edit the HTML to
  what the server *would* emit, but the edit is your hypothesis, not a
  measurement of it.
- **Anything after the load.** Interaction, INP, scrolling — a recording is one
  page load.
- **Variable content.** Personalised or A/B-tested pages are frozen at the
  moment of recording, which is a feature for comparison and a limitation for
  representativeness.

## Reporting a result

A useful report answers three questions: what was changed, what moved, and
whether the page still looks right.

```
Hypothesis : defer the tag manager
Edit       : removed <script src="gtm.js"> from contents/GET/https/example.com/index.html
Before     : LCP 3.41s  TBT 890ms  Overall 42   (artifacts-baseline/summary.md)
After      : LCP 2.78s  TBT 210ms  Overall 61   (artifacts/summary.md)
Visual     : no diff    (artifacts/capture-diff.txt)
Caveat     : removing the parent tag also removed 4 requests it injected
```
