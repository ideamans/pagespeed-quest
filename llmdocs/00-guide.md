# pagespeed-quest — reference for AI agents

PageSpeed Quest (`psq`) records a real page load through an HTTP proxy, writes
it to disk as an editable set of files, and replays it with the **original
timing** reproduced. You then edit those files — the HTML, the CSS, the images,
even the per-resource latency — replay again, and measure the difference.

The point is that you do **not** need the site's development environment, its
repository, or a deploy. Any public page can be frozen into a local, editable,
repeatable copy of itself. A hypothesis like "inlining critical CSS would gain
0.4s of LCP" becomes something you can answer in minutes, on someone else's
site, before writing a line of production code.

Recording is powered by [rust-http-playback-proxy]. Measurement is delegated to
[Lighthouse] (scores and metrics), [loadshow] (a video of the load) and
[static-webshot] (screenshots and visual diffs). `psq` is the layer that makes
the recording **editable** and the comparison **repeatable**.

[rust-http-playback-proxy]: https://github.com/ideamans/rust-http-playback-proxy
[Lighthouse]: https://developer.chrome.com/docs/lighthouse/overview/
[loadshow]: https://github.com/ideamans/go-loadshow
[static-webshot]: https://github.com/ideamans/static-webshot

This reference ships inside the package, so `psq llm` always describes the exact
version installed in the project you are working in.

## Ground rules

1. **Record once. Compare against that recording, never against the live site.**
   The live site changes between runs; the recording does not. That is the whole
   value proposition. A "before" measured against the network and an "after"
   measured against the inventory are not comparable numbers.

2. **Copy the inventory before you edit it.** There is no undo, and the baseline
   is the thing you are comparing to.

   ```sh
   cp -r inventory baseline
   ```

   Then measure either side by pointing `-i` at it. Keep `baseline/` untouched
   for the rest of the quest.

3. **`-i/--inventory` is a root option — it goes before the subcommand.**
   `psq -i ./baseline lighthouse playback` works; `psq lighthouse playback -i
   ./baseline` does not. The same applies one level down: `-a`, `-t`, `-l` and
   `-c` belong to the `lighthouse` / `loadshow` group, so they go *before*
   `recording` / `playback`.

4. **`playback` takes no URL.** The entry URL and the device type are stored in
   the inventory at recording time and reused. If you need to change either,
   record again.

5. **Lighthouse reports the load as observed** (`--throttling-method=provided`,
   `--throttling.*=0`, `cpuSlowdownMultiplier=1`). Timing is reproduced by the
   proxy, per resource, so Lighthouse must neither throttle again nor simulate.
   Its default `simulate` method re-derives the metrics from a network model
   that ignores the proxy — psq before 0.12 did that, and its numbers could even
   fall below the document's TTFB. Do not compare scores across that boundary.

6. **Unmatched requests get a 404.** The playback proxy only serves what is in
   the inventory. That is deliberate — falling through to the network would make
   the replay non-deterministic. So a URL you delete from `index.json` becomes a
   failed request, not a request that never happens. To model "this resource is
   gone", also remove the reference to it from the HTML.

7. **Never conclude from one run.** Runs of the same recording are close but
   not identical, and an occasional run is an outlier. Measure each state at
   least three times, compare medians, and treat a difference smaller than the
   spread within each state as no difference.

8. **The recording run is not the baseline.** `psq lighthouse recording` also
   writes a Lighthouse report, but it measured the live site through the
   recording proxy. Send it somewhere out of the way
   (`psq lighthouse -a ./artifacts/recording recording <url>`) and measure the
   baseline by playback.

## The loop

```sh
# 1. Freeze the page (writes ./inventory)
npx psq lighthouse -a ./artifacts/recording recording https://example.com/

# 2. Keep the untouched copy, and a copy that accumulates adopted changes
cp -r inventory baseline
cp -r inventory accepted

# 3. Measure the baseline, three runs  → artifacts/baseline-N/summary.md, lighthouse.report.json
for n in 1 2 3; do npx psq -i ./baseline lighthouse -a ./artifacts/baseline-$n playback; done

# 4. Each trial: start from accepted, make ONE edit to ./inventory (chapter "Experiments")
rm -rf inventory && cp -r accepted inventory

# 5. Measure the trial, three runs, and check it still renders (chapter "Measuring")
for n in 1 2 3; do npx psq lighthouse -a ./artifacts/t01-$n playback; done

# 6. Better beyond the spread and visually unchanged → adopt it
rm -rf accepted && cp -r inventory accepted

# 7. At the end, measure accepted against baseline from scratch
for n in 1 2 3; do npx psq -i ./accepted lighthouse -a ./artifacts/final-$n playback; done
```

`summary.md` is a short Markdown digest (metrics, per-metric scores with their
Lighthouse weights, traffic by resource type). Medians across runs and the
evidence for *why* a page is slow come from `lighthouse.report.json` — see
"Measuring".

## What lives where

| Path | What it is |
| --- | --- |
| `inventory/index.json` | the resource list and every resource's metadata. This is the file the proxy reads |
| `baseline/`, `accepted/` | conventional copies: the page as recorded, and the page with the adopted changes |
| `inventory/contents/<method>/<protocol>/<host>/<path>` | one file per recorded response body; `contentFilePath` gives the exact path |
| `artifacts/lighthouse.report.html`, `.report.json` | the full Lighthouse report |
| `artifacts/summary.md` | the digest to diff |
| `artifacts/lighthouse.digest.png` | score and metrics as an image |
| `artifacts/loadshow.mp4` | filmstrip video of the load |
| `artifacts/capture.png`, `capture-diff.png`, `capture-diff.txt` | screenshot and visual diff |

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `playback` serves nothing, every request 404s | the inventory is empty, or `-i` points at the wrong directory | record first; check `inventory/index.json` exists and `resources` is non-empty |
| `unknown option '-i'` / the option is ignored | root and group options were placed after the subcommand | `psq -i ./baseline lighthouse -a ./art playback` |
| the "after" is faster but the page is visibly broken | a referenced resource was deleted from `index.json` but not from the HTML | run `psq capture --compare` and look at the diff before trusting any number |
| edits to a `.js` / `.css` file seem to have no effect on transfer size | the resource has `"minify": true`, so playback re-minifies before serving | expected — the wire size reflects the minified bytes, which is what the original site shipped |
| the page looks fine but LCP got worse for no reason | an edit changed the byte size of a resource, and transfer time scales with size at the recorded `mbps` | that *is* the simulation working; check `summary.md` traffic figures |
| recording captured analytics and ad beacons | third parties were not excluded | re-record with `-x 'google-analytics|doubleclick|facebook'` (repeatable) |
| `loadshow` / `static-webshot` not found | the postinstall step that downloads them did not run | re-run `npm rebuild pagespeed-quest`, or set `LOADSHOW_PATH` / `WEBSHOT_PATH` |
| Lighthouse cannot be found | it resolves to `./node_modules/.bin/lighthouse` | run inside the quest project, or set `LIGHTHOUSE_PATH` |
| numbers drift between identical runs | normal measurement noise | three runs or more per state; compare medians against the spread |
| the baseline came from the recording run | that report measured the live site | measure the baseline with `psq -i ./baseline lighthouse … playback` |
| trial deltas cannot be attributed | a trial was built on the previous trial, or bundled several edits | start every trial from a fresh copy of `accepted/`, one edit each |

## What this tool will not do

- It does not crawl. One entry URL plus whatever that page load requests.
- It does not modify the live site, and nothing you edit locally reaches it.
- It does not rewrite your resources for you, and this reference does not
  prescribe optimizations. Deciding what to change is the work; this reference
  covers how an edit reaches the replay and how to measure it.
- It does not replay user interaction. What is recorded is one page load.
