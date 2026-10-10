---
name: psq-measure
description: Measure a PageSpeed Quest recording by replaying it through Lighthouse — repeat runs and take medians, read summary.md, dig the bottleneck evidence (LCP element and phases, request waterfall, script cost, third parties, failing insights) out of lighthouse.report.json, map it back to files in the inventory, and check the page still renders with a screenshot diff. Use to measure a baseline, to measure a trial edit, to find out where the load time goes, or to decide whether a change made a real difference.
license: GPL-3.0-or-later
compatibility: Requires a PageSpeed Quest project (see psq-install) and an inventory produced by psq-record. jq is used to read the Lighthouse JSON. Playback is fully local; no traffic reaches the recorded site.
allowed-tools: Bash(npx:*) Bash(mkdir:*) Bash(ls:*) Bash(cat:*) Bash(diff:*) Bash(jq:*) Bash(open:*) Read Write Glob Grep
---

# psq-measure

Every measurement replays a recording through the playback proxy, which
reproduces each resource's recorded latency and bandwidth. Nothing reaches the
live site, so two measurements of two recordings-in-a-directory are comparable;
a measurement of the live site is not comparable with anything here.

Run `npx psq llm` for the authoritative reference of the installed version.

## Measure one state, several times

```bash
for n in 1 2 3; do
  npx psq -i ./baseline lighthouse -a ./artifacts/baseline-$n playback
done
```

- `-i` (root option) selects the inventory directory to replay: `baseline`,
  `accepted`, or the working `inventory` (the default).
- `-a` (on `lighthouse`) is the output directory. Use **one directory per run**
  — the same `-a` twice overwrites.
- Name runs `<label>-<n>`, where the label names the state (`baseline`,
  `accepted`, `t03-defer-gtm`, `final`). The label is what the report will cite.

**Never conclude from one run.** Runs of the same recording are close but not
identical, and an occasional run is an outlier. Three runs per state is the
minimum; use five when the medians of two states are close. Each run takes
roughly 20–30 seconds.

The metrics are the load **as observed** in the replay (psq passes
`--throttling-method=provided`). Scores from psq before 0.12, which let
Lighthouse simulate them, are not comparable — never mix the two in one
comparison.

## Medians and spread

Save this once in the quest directory as `metrics.jq`:

```jq
# Usage: jq -s -r -f metrics.jq artifacts/<label>-*/lighthouse.report.json
def median: sort | if length % 2 == 1 then .[length / 2 | floor] else (.[length / 2 - 1] + .[length / 2]) / 2 end;
def r: . * 1000 | round / 1000;
map({
  Score: (.categories.performance.score * 100),
  LCP: .audits["largest-contentful-paint"].numericValue,
  FCP: .audits["first-contentful-paint"].numericValue,
  SI: .audits["speed-index"].numericValue,
  TBT: .audits["total-blocking-time"].numericValue,
  CLS: .audits["cumulative-layout-shift"].numericValue
}) as $runs
| "metric\tmedian\tmin\tmax\t(runs: \($runs | length))",
  (["Score", "LCP", "FCP", "SI", "TBT", "CLS"][] as $m
   | [$runs[][$m]] as $v
   | "\($m)\t\($v | median | r)\t\($v | min | r)\t\($v | max | r)")
```

```bash
jq -s -r -f metrics.jq artifacts/baseline-*/lighthouse.report.json
```

Milliseconds for LCP / FCP / SI / TBT; CLS is unitless; Score is 0–100.

**A difference between two states is real only if the medians differ by more
than the spread (max − min) within each state.** If the ranges overlap, measure
more runs before deciding, or call it no effect.

## What each run writes

| File | Contents |
| --- | --- |
| `summary.md` | metrics, per-metric scores with Lighthouse weights (LCP ×0.25, CLS ×0.25, TBT ×0.30, FCP ×0.10, SI ×0.10), *Traffic* (bytes received, as Lighthouse measured them) and *Resource* (decoded) bytes by type |
| `lighthouse.report.json` | the full report — the evidence for the investigation below |
| `lighthouse.report.html` | the same, for a human (`open` it) |
| `lighthouse.digest.png` | score and metrics as one image, for the report |
| `lighthouse-0.trace.json` | the Chrome trace, for a deep dive in DevTools' Performance panel |

`summary.md` is for a quick look and for the *Traffic* table; use `metrics.jq`
for any number you will compare or report.

## Find where the time goes

The questions below are answered from one run's `lighthouse.report.json`
(set `J=artifacts/baseline-1/lighthouse.report.json`). Deciding what to change
is up to you; this is how to get the evidence.

**Which audits flag a problem, and their estimated savings:**

```bash
jq -r '.audits[] | select(.score != null and .score < 1
  and .scoreDisplayMode != "informative" and .scoreDisplayMode != "notApplicable")
  | [.id, .score, (.displayValue // ""),
     (.metricSavings // {} | to_entries | map("\(.key)=\(.value)") | join(","))] | @tsv' $J
```

Lighthouse 13 puts most of the diagnosis in `*-insight` audits
(`lcp-breakdown-insight`, `render-blocking-insight`, `network-dependency-tree-insight`,
`image-delivery-insight`, `third-parties-insight`, `font-display-insight`,
`cls-culprits-insight`, …). Read any of them in full with
`jq '.audits["<id>"].details' $J`.

**The LCP element and how its time splits:**

```bash
jq -r '.audits["lcp-breakdown-insight"].details.items[] | select(.type == "node") | .snippet' $J
jq -r '.audits["lcp-breakdown-insight"].details.items[] | select(.type == "table") | .items[]
  | "\(.subpart)\t\(.duration | floor) ms"' $J
```

`timeToFirstByte` / `resourceLoadDelay` / `resourceLoadDuration` /
`elementRenderDelay` — the largest phase says where to look.

**The request waterfall** (ms from navigation start):

```bash
jq -r '.audits["network-requests"].details.items | sort_by(.networkRequestTime)[]
  | "\(.networkRequestTime | floor)\t\(.networkEndTime | floor)\t\(.transferSize)\t\(.resourceType)\t\(.priority)\t\(.url)"' $J
```

**Script cost per URL, and third parties per entity:**

```bash
jq -r '.audits["bootup-time"].details.items[] | "\(.total | floor)\t\(.scripting | floor)\t\(.url)"' $J
jq -r '.audits["third-parties-insight"].details.items[]
  | "\(.entity)\t\(.transferSize)\t\(.mainThreadTime | floor) ms"' $J
```

**From a URL in the report to the file to edit:**

```bash
jq -r --arg u "https://example.com/assets/app.js" \
  '.resources[] | select(.url == $u) | [.contentFilePath, .ttfbMs, .mbps, .contentEncoding, .minify] | @tsv' \
  inventory/index.json
```

The path is relative to the inventory directory (it starts with `contents/`).
See **psq-inventory** for what each field does when you change it.

### Findings the recording cannot act on

Some audits report problems that a replay cannot reproduce or fix. Note them for
the user, but do not try to improve them in the inventory:

| Audit | Why |
| --- | --- |
| `cache-insight`, `bf-cache` | every playback is a cold load; caching across views is not modelled |
| `modern-http-insight` | the protocol is the proxy's, not the origin's |
| `inp-breakdown-insight`, interaction metrics | a recording is one page load, no interaction |

## Check the page still renders

After any edit that removes, moves or rewrites something, compare a screenshot
with the baseline before trusting a faster number:

```bash
npx psq -i ./baseline capture -a ./artifacts/baseline-capture        # once
npx psq capture -a ./artifacts/t03-capture \
  --compare ./artifacts/baseline-capture/capture.png \
  --baseline-label "Baseline" --current-label "t03"
```

Read `capture-diff.txt` and look at `capture-diff.png`. `capture` replays at
full speed (no latency, no bandwidth limit) because it answers *what* the page
looks like — never take a timing from it.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| two states differ by a few points and the next run reverses it | run-to-run variance | compare medians of ≥3 runs and the spread; measure 5 when close |
| the second run overwrote the first | the same `-a` directory | one directory per run: `<label>-<n>` |
| `summary.md` has no Traffic section | that is the recording run's report (live site) | measure by playback |
| every request 404s | `-i` points at an empty or wrong directory | check `<dir>/index.json` has resources |
| `unknown option '-i'` | root option placed after a subcommand | `psq -i ./baseline lighthouse -a ./art playback` |
| an insight's savings never move however much you edit | it is one the recording cannot model (cache, protocol, interaction) | report it as out of scope for the replay |
| `jq: Cannot iterate over null` on an insight | that insight has no items for this page | read `.details` and move on |
| faster score, broken page | something the page needs was removed | always run the capture comparison after a structural edit |
| timings look impossibly fast | a number was read from a `capture` run | timings only from `lighthouse playback` |
