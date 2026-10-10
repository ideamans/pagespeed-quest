---
name: psq-usage
description: Run a whole PageSpeed Quest speed investigation of a URL with the `psq` CLI — record the page, measure the baseline, find the bottlenecks, try improvements one at a time on the recording, keep the ones that measurably help, and report what was changed and how much each metric and the score improved. Use when the user asks to improve, speed up or audit the loading speed of a page or URL, to propose front-end speed improvements backed by measurements, to estimate how much an optimization would gain without deploying it, or mentions PageSpeed Quest / psq. Entry point for the other psq-* skills.
license: GPL-3.0-or-later
compatibility: Requires a PageSpeed Quest project with `pagespeed-quest` installed as a dev dependency (see psq-install), network access to the page for the one recording, and jq. Everything after the recording runs locally.
allowed-tools: Bash(npx:*) Bash(yarn:*) Bash(npm:*) Bash(cp:*) Bash(rm:*) Bash(mv:*) Bash(mkdir:*) Bash(ls:*) Bash(cat:*) Bash(diff:*) Bash(du:*) Bash(find:*) Bash(jq:*) Read Write Edit Glob Grep
---

# psq-usage

Answer "how could this page load faster, and by how much?" with measurements,
without the site's repository, development environment or a deploy.

`psq` freezes one real page load into editable files and replays it with each
resource's recorded latency and bandwidth. You change the recording, replay it,
and compare. Because every number comes from the same frozen recording, a delta
is the effect of your change and nothing else.

**This skill is the procedure; it does not tell you which optimizations to
make.** Diagnosing the page and choosing what to try is your judgement. The
skills it hands off to:

| Step | Skill |
| --- | --- |
| set up the project | **psq-install** |
| record and freeze the page | **psq-record** |
| measure, find bottlenecks, check rendering | **psq-measure** |
| change the recording | **psq-inventory** |
| before/after video (optional) | **psq-video** |

`npx psq llm` prints the full reference for the installed version.

## 0. Agree the scope

Before recording, settle with the user — or state your assumptions:

- the URL, and `mobile` (default) or `desktop`
- whether third-party tags are in scope (they decide `-x` at recording time)
- how much to try: a fixed number of trials, or until a target is met.
  Without an answer, stop after about five trials or when nothing promising is
  left
- recording a site the user does not own sends real traffic to it — confirm

## 1. Set up and record

```bash
mkdir -p example-com-quest && cd example-com-quest   # psq-install if psq is missing
npx psq lighthouse -a ./artifacts/recording recording https://example.com/
```

Check the recording and freeze it, as described in **psq-record**:

```bash
cp -r inventory baseline
cp -r inventory accepted
mkdir -p trials
```

The quest directory then holds:

| Path | Role |
| --- | --- |
| `baseline/` | the page as recorded. Never edited |
| `accepted/` | baseline + every adopted change so far |
| `inventory/` | the working copy for the current trial — what `psq` replays by default |
| `artifacts/<label>-<n>/` | one Lighthouse run each |
| `trials/<id>.diff` | what each trial changed |
| `quest-log.md` | one line per trial — the source for the report |

## 2. Measure the baseline

```bash
for n in 1 2 3; do npx psq -i ./baseline lighthouse -a ./artifacts/baseline-$n playback; done
npx psq -i ./baseline capture -a ./artifacts/baseline-capture
jq -s -r -f metrics.jq artifacts/baseline-*/lighthouse.report.json
```

(`metrics.jq` is defined in **psq-measure**.) Tell the user the starting
position — score and the five metrics — before changing anything.

## 3. Investigate

Use the report-reading recipes in **psq-measure** and the recorded sources
(`inventory/contents/…`, located via `contentFilePath`) to build a list of
candidate changes. For each, note the evidence (which audit, which request,
which file) and which metric it should move. Order them by expected effect on
the score — the metric weights are in `summary.md`.

Leave aside findings the replay cannot act on (caching across views, protocol,
interaction) — mention them in the report instead.

## 4. Trial loop

For each candidate, one at a time:

```bash
# a. start from what has been adopted so far
rm -rf inventory && cp -r accepted inventory

# b. make ONE change in ./inventory   (psq-inventory)

# c. keep a record of the change
diff -ru accepted inventory > trials/t01-<slug>.diff

# d. does the page still render the same?
npx psq capture -a ./artifacts/t01-capture \
  --compare ./artifacts/baseline-capture/capture.png --baseline-label Baseline --current-label t01

# e. measure
for n in 1 2 3; do npx psq lighthouse -a ./artifacts/t01-<slug>-$n playback; done
jq -s -r -f metrics.jq artifacts/t01-<slug>-*/lighthouse.report.json
```

Compare with the current reference — the latest adopted trial, or the baseline
if nothing has been adopted yet. Then decide:

| Result | Action |
| --- | --- |
| medians clearly better than the reference (beyond the spread), page renders the same | **adopt**: `rm -rf accepted && cp -r inventory accepted`; this trial becomes the reference |
| no difference beyond the spread | **reject**, or measure two more runs per side if it is close |
| worse, or the capture shows a broken or changed page | **reject**, or fix the edit and run it again as a new trial |

Rejecting needs no clean-up — the next trial starts again from `accepted/`.
Never adopt on a single run, and never adopt a change that alters what the page
shows unless the user agreed to that change.

Append one line to `quest-log.md` per trial, adopted or not:

```markdown
| id | change | evidence | Score | LCP | TBT | CLS | FCP | SI | render | decision |
| t01 | defer tag manager | render-blocking-insight: gtm.js | 61→68 | 3.41→2.95 s | … | … | … | … | same | adopted |
```

Values are medians, reference → trial.

## 5. Confirm the result

When the loop ends, measure the final state against the baseline from scratch —
adopted changes interact, so the sum of trial deltas is not the total:

```bash
for n in 1 2 3; do npx psq -i ./accepted lighthouse -a ./artifacts/final-$n playback; done
npx psq -i ./accepted capture -a ./artifacts/final-capture \
  --compare ./artifacts/baseline-capture/capture.png --baseline-label Baseline --current-label Final
jq -s -r -f metrics.jq artifacts/baseline-*/lighthouse.report.json
jq -s -r -f metrics.jq artifacts/final-*/lighthouse.report.json
diff -ru baseline accepted > trials/final.diff
```

If the user wants something to show, make a before/after video with
**psq-video** (`-i ./baseline` and `-i ./accepted`).

## 6. Report

Write it in the user's language. Lead with the result, then the evidence:

1. **Result** — baseline → final medians for the score and each metric, number
   of runs per side, and the visual check (`final-capture/capture-diff.txt`).
2. **What was wrong and what was changed** — for each adopted trial: the
   problem and its evidence, the change (file and a short description; the
   diff is in `trials/`), and the delta it produced when adopted.
3. **Tried and not adopted** — each rejected trial and why (no effect, worse,
   broke the page). This is as informative as the adopted list.
4. **Not addressed** — findings the replay cannot model, and anything left for
   later.
5. **Caveats** — these are measurements of a replay of one recording on this
   machine, not field data; personalised or A/B-tested content was frozen as
   recorded; changes the edit assumes of the server (headers, compression,
   response time) are hypotheses for the site owner to implement.

Point to `artifacts/final-1/lighthouse.digest.png` and
`artifacts/baseline-1/lighthouse.digest.png` as ready-made images.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| trial deltas cannot be attributed | several changes in one trial, or a trial built on the previous trial instead of on `accepted/` | one change per trial; always `rm -rf inventory && cp -r accepted inventory` first |
| the baseline numbers came from the recording run | the recording run's report was read as the baseline | the baseline is `psq -i ./baseline lighthouse … playback`; the recording run measures the live site |
| an adopted change turns out to be noise | adopted on one run, or on a delta smaller than the spread | three runs per state minimum, compare medians and spread |
| final total is smaller than the sum of the adopted deltas | adopted changes overlap | report the final-vs-baseline measurement as the result, not the sum |
| faster but the page looks different | an edit removed or changed visible content | check the capture diff every trial; reject or fix |
| `unknown option` on `-i` / `-a` | options placed after the subcommand they do not belong to | `psq -i ./accepted lighthouse -a ./artifacts/x-1 playback` |
| every request 404s | `-i` points at an empty or wrong directory | check `<dir>/index.json` |
| a comparison against the live site | numbers taken from a browser or PageSpeed Insights | every number in the report comes from a playback of this recording |
| the quest drags on | no stopping rule | agree a trial budget or a target in step 0 |
