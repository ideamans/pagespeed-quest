# Measuring — scores, video, screenshots

Three measurement surfaces, all driven through the same playback proxy so they
see the same page. Choose by the question being asked.

| Question | Command | Read |
| --- | --- | --- |
| Did the score move? | `psq lighthouse playback` | `artifacts/summary.md` |
| What does the difference look like? | `psq loadshow playback` | `artifacts/loadshow.mp4` |
| Did I break the page? | `psq capture --compare <png>` | `artifacts/capture-diff.png` |

Keep the two sides in separate artifact directories. `-a` is an option of the
`lighthouse` / `loadshow` group, so it goes before the sub-subcommand.

## Lighthouse, several runs per state

```sh
for n in 1 2 3; do psq -i ./baseline lighthouse -a ./artifacts/baseline-$n playback; done
for n in 1 2 3; do psq -i ./inventory lighthouse -a ./artifacts/t01-$n playback; done
```

One directory per run — the same `-a` twice overwrites. Name them
`<label>-<n>`, the label naming the state.

Each run writes:

| File | Contents |
| --- | --- |
| `summary.md` | metrics, per-metric scores with weights, overall score, traffic and resource size by type |
| `lighthouse.report.html` | the full report (open it when a number needs explaining) |
| `lighthouse.report.json` | the same, machine-readable — the source for medians and for the diagnosis |
| `lighthouse.digest.png` | score gauge and metrics as one image — the thing to paste into a report |
| `lighthouse-0.trace.json`, `*.devtoolslog.json` | saved assets (`--save-assets`) |

A playback run takes roughly 20–30 seconds: Lighthouse measures the load as
observed (`--throttling-method=provided`) and waits for the page to go quiet.

Options on the `lighthouse` group: `-a/--artifacts` (default `./artifacts`),
`-t/--timeout` (ms, default 30000), `-l/--laud` — show the browser window and
open the report at the end. `--laud` is for watching a run, not for measuring;
a visible browser is not the same environment as the headless one.

### Medians and spread

**Never conclude from one run.** Runs of the same recording are close but not
identical, and an occasional run is an outlier. Take the median of at least three runs
per state, and call a difference real only when it is larger than the spread
(max − min) within each state:

```sh
jq -s -r '
  def median: sort | if length % 2 == 1 then .[length/2|floor] else (.[length/2-1] + .[length/2]) / 2 end;
  map({Score: (.categories.performance.score*100),
       LCP: .audits["largest-contentful-paint"].numericValue,
       FCP: .audits["first-contentful-paint"].numericValue,
       SI:  .audits["speed-index"].numericValue,
       TBT: .audits["total-blocking-time"].numericValue,
       CLS: .audits["cumulative-layout-shift"].numericValue}) as $r
  | ["Score","LCP","FCP","SI","TBT","CLS"][] as $m | [$r[][$m]] as $v
  | "\($m)\t\($v|median)\t\($v|min)\t\($v|max)"' artifacts/baseline-*/lighthouse.report.json
```

### Where the time goes

`lighthouse.report.json` holds the evidence. With
`J=artifacts/baseline-1/lighthouse.report.json`:

| Question | jq |
| --- | --- |
| which audits flag a problem | `.audits[] \| select(.score != null and .score < 1) \| [.id, .displayValue, .metricSavings]` |
| the LCP element | `.audits["lcp-breakdown-insight"].details.items[] \| select(.type=="node") \| .snippet` |
| how LCP time splits | `.audits["lcp-breakdown-insight"].details.items[] \| select(.type=="table") \| .items` |
| the request waterfall | `.audits["network-requests"].details.items` (`networkRequestTime`, `networkEndTime`, `transferSize`, `url`) |
| script cost per URL | `.audits["bootup-time"].details.items` |
| third parties | `.audits["third-parties-insight"].details.items` |

Lighthouse 13 keeps most of its diagnosis in `*-insight` audits. To act on a
URL, look up its `contentFilePath` in `index.json`. `cache-insight`, `bf-cache`,
`modern-http-insight` and interaction metrics describe things a replay cannot
model (see "Experiments").

## Video of the load, before and after

```sh
psq -i ./baseline loadshow -a ./artifacts/video-baseline playback
psq -i ./accepted loadshow -a ./artifacts/video-after    playback
```

Each writes `<artifacts>/loadshow.mp4` — a filmstrip of the load, laid out in
3 columns for mobile recordings and 2 for desktop, plus
`<artifacts>/loadshow/summary.md` and the intermediate frames in
`<artifacts>/loadshow/`.

Use `-c/--credit` to stamp a label into the video, which is what makes a pair of
videos legible side by side:

```sh
psq -i ./baseline loadshow -a ./artifacts/video-baseline -c "Before" playback
psq -i ./accepted loadshow -a ./artifacts/video-after    -c "After — deferred GTM" playback
```

To place them side by side, stack the two MP4s with ffmpeg; `psq` does not
compose videos:

```sh
ffmpeg -i artifacts/video-baseline/loadshow.mp4 -i artifacts/video-after/loadshow.mp4 \
  -filter_complex hstack -c:v libx264 before-after.mp4
```

### Recording *with* loadshow rather than Lighthouse

```sh
psq loadshow recording https://example.com/
```

Lighthouse and loadshow drive the browser slightly differently. If the goal of
the quest is the video rather than the score, record with `loadshow recording`
so that the recording and the playback are driven the same way.

## Screenshot and visual diff

```sh
psq -i ./baseline capture -a ./artifacts/baseline-capture
psq capture -a ./artifacts/t01-capture --compare ./artifacts/baseline-capture/capture.png \
    --baseline-label "Before" --current-label "After"
```

`capture` runs the proxy in **full-throttle** mode — no TTFB, no bandwidth
simulation — because the question is what the page looks like when fully
loaded, not when. Never quote a timing number from a `capture` run.

Output: `capture.png` (rendered at 400×1600, resized to 200×800),
`capture-diff.png`, and `capture-diff.txt` with a text digest of the difference.

Run this after **every** structural edit. A deleted script that also removed a
banner will make every metric better and the page wrong.

## Reading `summary.md`

```
## Metrics
- LCP 2780 ms
- CLS 0.02
...
## Scores
- LCP 0.71 x0.25
- TBT 0.88 x0.30
- **Overall** 0.61
## Traffic: Type / Count / Size / Bytes
- script / 14 / 512.3 KB / 524595
```

*Traffic* is what crossed the wire (after compression); *Resource* is the
decompressed size. A change that moves resource size but not traffic size means
you edited something that compresses away — expect little timing effect.
