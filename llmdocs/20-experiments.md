# Experiments — how an edit reaches the replay

This chapter is about the mechanics of changing a recording so that a replay
reflects a change you want to test. **It does not prescribe optimizations** —
deciding what to try is the agent's or the engineer's judgement. What matters
here is that the edit models what you intend, and nothing else.

Paths below are relative to the inventory directory.

## Content edits

Edit the file a resource's `contentFilePath` points to. The browser receives and
executes exactly those bytes, so effects on parsing, script execution, layout
and paint are **measured, not estimated**, and the transfer time follows the new
size (see the timing model in "The inventory" — this needs a recording with
`formatVersion: 2`, i.e. made with psq 0.12 or later).

psq-specific rules:

- **Changing an image's format** — replace the bytes at the same path, then set
  the served type to match:

  ```json
  { "contentTypeMime": "image/webp", "rawHeaders": { "content-type": "image/webp" } }
  ```

  The URL may keep its old extension; browsers go by `Content-Type`. Never edit
  `content-length`.
- **`minify: true`** — the file is re-minified before serving. Whitespace has no
  effect on the wire; a syntax error may surface as a minifier failure.
- **Leave `original` and `originals/` alone.** They are how playback recognises
  the resources you did not touch and serves them exactly as recorded.
- **`ttfbMs` does not move with the content.** A preloaded, reprioritised or
  shrunk resource still waits its recorded `ttfbMs` before its first byte.

## Adding and removing resources

- **Removing**: delete the reference from the HTML (or CSS, or script) in the
  same edit. An entry deleted while still referenced becomes a 404 — a failed
  request, which makes the result look worse than the truth. Removing a parent
  tag also removes whatever it would have injected; say so when reporting.
- **Adding** (a split file, a self-hosted font, a new preload): add an entry to
  `resources`. `method`, `url` and `ttfbMs` are required — an entry missing them
  makes `index.json` unreadable. Set `statusCode`, `contentTypeMime` and
  `contentFilePath`, and copy `ttfbMs` / `mbps` from a comparable resource on
  the same host so the timing is not invented. Any URL the browser requests
  that has no entry gets a 404.

## Metadata edits — what a front-end change cannot do

These levers do not exist in a normal development environment, and they are the
reason for the `index.json` fields.

| To model | Edit | Note |
| --- | --- | --- |
| a faster or slower origin | lower / raise `ttfbMs`, the document first | separates the back-end share of the load from the front-end share |
| a faster or slower link, a CDN | `mbps` on every resource of that host | per host, not per file, or the result resembles nothing real |
| compression on or off | `contentEncoding` (`br`, `gzip`, `identity`) on text resources | the proxy re-compresses; the reverse quantifies what compression already buys |
| a different form factor | top-level `deviceType` | changes the Lighthouse form factor and the loadshow preset; does not re-record |

## What this cannot model

State these plainly when reporting results.

- **Caching across page views.** Every playback is a cold load, so
  `cache-insight` and `bf-cache` findings cannot be acted on in a replay.
- **HTTP/2 prioritisation and connection contention.** Each host is served by
  the local proxy; the real contention on a shared connection is not
  reproduced, and `modern-http-insight` describes the proxy, not the origin.
- **Server-side changes that alter the HTML.** You can hand-edit the HTML to
  what the server *would* emit, but the edit is your hypothesis, not a
  measurement of it.
- **Anything after the load.** Interaction, INP, scrolling — a recording is one
  page load.
- **Variable content.** Personalised or A/B-tested pages are frozen at the
  moment of recording, which is a feature for comparison and a limitation for
  representativeness.

## Reporting a trial

A useful line answers four questions: what was changed, what evidence led to it,
what moved (medians of several runs, reference → trial), and whether the page
still looks right.

```
Trial      : t01 defer tag manager
Evidence   : render-blocking-insight lists gtm.js
Edit       : contents/get/https/example.com/index.html — added defer to <script src="gtm.js">
Reference  : Score 61  LCP 3.41s  TBT 890ms   (median of 3, artifacts/baseline-*)
Trial      : Score 68  LCP 2.95s  TBT 640ms   (median of 3, artifacts/t01-defer-gtm-*)
Visual     : no diff (artifacts/t01-capture/capture-diff.txt)
Decision   : adopted
```
