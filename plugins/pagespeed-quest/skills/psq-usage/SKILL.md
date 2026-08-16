---
name: psq-usage
description: Run a PageSpeed Quest investigation with the `psq` CLI — freeze any public web page into a local recording, replay it with its original timing, and measure a front-end speed hypothesis with Lighthouse before and after. Use when the user wants to know how much a proposed optimization would gain, wants a before/after speed comparison for a page they cannot deploy to, or asks to audit a site's loading performance reproducibly.
license: GPL-3.0-or-later
compatibility: Requires a PageSpeed Quest project with `pagespeed-quest` installed as a dev dependency (see the psq-install skill) and network access to the page being recorded. Recording drives a real browser against the real site.
allowed-tools: Bash(npx:*) Bash(yarn:*) Bash(npm:*) Bash(cp:*) Bash(mkdir:*) Bash(ls:*) Bash(cat:*) Bash(diff:*) Bash(du:*) Bash(find:*) Read Write Edit Glob Grep
---

# psq-usage

Answer "how much would this optimization actually gain?" without the site's
development environment, repository or a deploy.

`psq` records a real page load through a proxy, writes it to disk as editable
files, and replays it reproducing the original per-resource latency and
bandwidth. You edit the recording, replay, and compare. Because both sides come
from the same frozen recording, the delta means something — unlike two
measurements of a live site taken minutes apart.

**Read `npx psq llm` first.** It is the full reference for the installed
version: the inventory schema, the timing model, and the catalogue of which edit
models which optimization. This skill is the workflow; that is the manual.

## Before starting

- If `npx psq --help` fails, use the **psq-install** skill.
- Recording sends real traffic to the target site from wherever this runs. On a
  site the user does not own, confirm that is acceptable before recording.
- Work inside the quest project directory. `inventory/` and `artifacts/` are
  written relative to the working directory.

## Workflow

### 1. Record the page

```bash
npx psq lighthouse recording https://example.com/
```

- `-d/--device mobile|desktop` on `recording` (default `mobile`). Mobile is the
  right default — it is where the problems are, and it is what Lighthouse
  scores by default.
- `-x/--exclude <regex>` (repeatable) drops noisy third parties from the
  recording. Use it when the user wants to study their own code:
  `-x 'google-analytics|doubleclick|connect\.facebook'`. Do **not** use it when
  the question is "what are the third parties costing us" — that is an
  experiment, not noise.

This writes `inventory/index.json` and `inventory/contents/…`.

### 2. Freeze the baseline

```bash
cp -r inventory baseline
```

Non-negotiable. There is no undo on the inventory, and every later number is
relative to this copy.

### 3. Measure the baseline

```bash
npx psq -i ./baseline lighthouse -a ./artifacts-baseline playback
```

Read `artifacts-baseline/summary.md` — metrics, per-metric scores with their
Lighthouse weights, and traffic broken down by resource type. Report the
starting position to the user before changing anything.

Note the option order: `-i` belongs to `psq`, `-a` belongs to `lighthouse`, so
each goes before the next subcommand.

### 4. Form one hypothesis

Read `summary.md` and the recording, and pick **one** change. The traffic
breakdown usually points at it: an image type dominating transfer, a script
count that explains TBT, a document `ttfbMs` that explains everything.

State the hypothesis to the user before editing, in the form "if X, then metric
Y should improve by roughly Z".

### 5. Edit the recording

Use the **psq-inventory** skill for the file layout and the recipe catalogue.
One edit per measurement — two edits mean an unattributable delta.

### 6. Measure again

```bash
npx psq lighthouse -a ./artifacts-after playback
diff artifacts-baseline/summary.md artifacts-after/summary.md
```

### 7. Check the page still renders

```bash
npx psq -i ./baseline capture -a ./artifacts-baseline
npx psq capture --compare ./artifacts-baseline/capture.png \
  --baseline-label "Before" --current-label "After"
```

Look at `artifacts/capture-diff.png` and `capture-diff.txt`. A faster broken
page is the most common false positive in this workflow, and it is invisible in
the score.

### 8. Report

Give the user, for each hypothesis: what was edited, the metric deltas, the
overall score change, and whether the page still looks right. Repeat a
measurement before reporting anything under ~5% — Lighthouse noise on a fixed
recording is a few points either way.

## Choosing the measurement surface

| Question | Command | Output |
| --- | --- | --- |
| Did the score move? | `psq lighthouse playback` | `artifacts/summary.md` |
| What does it look like? | `psq loadshow playback` | `artifacts/loadshow.mp4` — see the **psq-video** skill |
| Did I break it? | `psq capture --compare <png>` | `artifacts/capture-diff.png` |

## Iterating interactively

```bash
npx psq proxy -p 8080
```

serves the inventory and restarts on any change under it. Point a browser at
`http://localhost:8080` with certificate checks disabled and edits show up on
reload — much faster than a Lighthouse run per keystroke:

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --ignore-certificate-errors --proxy-server=http://localhost:8080
```

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| every request 404s during playback | empty inventory, or `-i` points elsewhere | record first; check `inventory/index.json` has a non-empty `resources` |
| `unknown option` on `-i` / `-a` | options placed after the subcommand they do not belong to | `psq -i ./baseline lighthouse -a ./art playback` |
| `playback` asks for a URL | it never does — a URL was passed by mistake | the entry URL comes from the inventory; re-record to change it |
| the after-run is faster but the page is broken | a resource was removed from `index.json` while the HTML still references it | always run `psq capture --compare`; remove the reference too |
| editing a `.js`/`.css` file changes nothing on the wire | that resource has `"minify": true` and is re-minified before serving | expected; only real byte reductions show up |
| the score swings between identical runs | measurement noise | repeat three times per side; ignore deltas under ~5% |
| recording is full of ad and analytics traffic | third parties were not excluded | re-record with `-x`, unless the third parties are the subject |
| Lighthouse not found | it resolves to `./node_modules/.bin/lighthouse` | run inside the quest project, or set `LIGHTHOUSE_PATH` |
| a recording of a personalised or A/B-tested page looks unrepresentative | the recording froze one variant | record again and compare; state the caveat in the report |
| timings look impossibly fast | the run used `capture` (full-throttle) | never quote timing from `capture`; it disables the timing simulation on purpose |
