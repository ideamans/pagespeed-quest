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

## Lighthouse before / after

```sh
psq -i ./baseline  lighthouse -a ./artifacts-baseline playback
psq -i ./inventory lighthouse -a ./artifacts-after    playback
diff artifacts-baseline/summary.md artifacts-after/summary.md
```

Each run writes:

| File | Contents |
| --- | --- |
| `summary.md` | metrics, per-metric scores with weights, overall score, traffic and resource size by type |
| `lighthouse.report.html` | the full report (open it when a number needs explaining) |
| `lighthouse.report.json` | the same, machine-readable |
| `lighthouse.digest.png` | score gauge and metrics as one image — the thing to paste into a report |
| `lighthouse-0.trace.json`, `*.devtoolslog.json` | saved assets (`--save-assets`) |

`summary.md` is the file to diff. It is deliberately short and stable, so the
diff shows the delta and nothing else.

Options on the `lighthouse` group: `-a/--artifacts` (default `./artifacts`),
`-t/--timeout` (ms, default 30000), `-l/--laud` — show the browser window and
open the report at the end. `--laud` is for watching a run, not for measuring;
a visible browser is not the same environment as the headless one.

**Repeat before concluding.** Lighthouse noise on a fixed recording is a few
points. Three runs per side is usually enough to see whether a delta is real.

## Video of the load, before and after

```sh
psq -i ./baseline  loadshow -a ./artifacts-baseline playback
psq -i ./inventory loadshow -a ./artifacts-after    playback
```

Each writes `<artifacts>/loadshow.mp4` — a filmstrip of the load, laid out in
3 columns for mobile recordings and 2 for desktop, plus
`<artifacts>/loadshow/summary.md` and the intermediate frames in
`<artifacts>/loadshow/`.

Use `-c/--credit` to stamp a label into the video, which is what makes a pair of
videos legible side by side:

```sh
psq -i ./baseline  loadshow -a ./artifacts-baseline -c "Before" playback
psq -i ./inventory loadshow -a ./artifacts-after    -c "After — deferred GTM" playback
```

To place them side by side, stack the two MP4s with ffmpeg; `psq` does not
compose videos:

```sh
ffmpeg -i artifacts-baseline/loadshow.mp4 -i artifacts-after/loadshow.mp4 \
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
psq -i ./baseline capture -a ./artifacts-baseline      # baseline.png
psq capture --compare ./artifacts-baseline/capture.png \
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
