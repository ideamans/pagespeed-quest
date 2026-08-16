---
name: psq-video
description: Produce a video of a web page loading, and a before/after pair showing what a speed optimization actually looks like, using the `psq loadshow` subcommand of PageSpeed Quest. Use when the user wants a filmstrip or screen recording of a page load, wants to show a speed improvement to people who do not read Lighthouse reports, or asks for a visual before/after of a front-end change.
license: GPL-3.0-or-later
compatibility: Requires a PageSpeed Quest project (see psq-install); the loadshow binary is downloaded by its postinstall step, or pointed at with LOADSHOW_PATH. ffmpeg is needed only for stacking two videos side by side.
allowed-tools: Bash(npx:*) Bash(yarn:*) Bash(cp:*) Bash(ls:*) Bash(cat:*) Bash(ffmpeg:*) Bash(open:*) Read Write Edit Glob Grep
---

# psq-video

A score moves a discussion among engineers. A video moves everyone else. This
skill produces `loadshow` filmstrip videos of a page load — one side, or a
before/after pair from the same recording.

Run `npx psq llm` for the full reference of the installed version.

## Single video

From an existing recording:

```bash
npx psq loadshow playback
```

Writes `artifacts/loadshow.mp4`, plus `artifacts/loadshow/summary.md` and the
intermediate frames under `artifacts/loadshow/`. Layout is 3 columns for a
mobile recording, 2 for desktop — taken from the `deviceType` stored in the
inventory.

To record and film a page in one step, without an existing inventory:

```bash
npx psq loadshow recording https://example.com/
```

**Prefer `loadshow recording` when the video is the deliverable.** Lighthouse
and loadshow drive the browser slightly differently; recording and replaying
through the same driver gives a truer film.

## Before / after pair

The whole point: both videos come from the same frozen recording, so the
difference on screen is the change and nothing else.

```bash
# 1. record, then freeze the baseline
npx psq loadshow recording https://example.com/
cp -r inventory baseline

# 2. film the baseline
npx psq -i ./baseline loadshow -a ./artifacts-baseline -c "Before" playback

# 3. edit ./inventory  (use the psq-inventory skill)

# 4. film the edited version
npx psq loadshow -a ./artifacts-after -c "After — deferred tag manager" playback
```

`-c/--credit` stamps a label into the video. Always set it on a pair — an
unlabelled before/after is unusable a week later.

Option order matters: `-i` belongs to `psq`, `-a` and `-c` belong to
`loadshow`, so each goes before the next subcommand.

### Stack them side by side

`psq` does not compose videos. Use ffmpeg:

```bash
ffmpeg -i artifacts-baseline/loadshow.mp4 -i artifacts-after/loadshow.mp4 \
  -filter_complex hstack -c:v libx264 before-after.mp4
```

`vstack` instead of `hstack` for a vertical pair, which reads better for mobile
filmstrips on a slide.

The two videos have different durations — the faster side simply ends earlier,
and that gap *is* the result. Do not pad them to equal length; it hides the
finding.

## Pairing the video with numbers

A video shows the shape of the improvement, not its size. Ship both:

```bash
npx psq -i ./baseline lighthouse -a ./artifacts-baseline playback
npx psq lighthouse -a ./artifacts-after playback
diff artifacts-baseline/summary.md artifacts-after/summary.md
```

`artifacts-*/lighthouse.digest.png` is a ready-made score-and-metrics image to
put next to the video.

Use the **psq-usage** skill for the full measurement loop, and **psq-inventory**
for what to edit between the two takes.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `loadshow` not found | the postinstall download did not run or the platform has no prebuilt binary | `npm rebuild pagespeed-quest`, or build go-loadshow and set `LOADSHOW_PATH` |
| the video is empty or truncated | the load exceeded the timeout | raise it: `loadshow -t 60000 playback` |
| both videos look identical | the edit was made to `baseline/` instead of `inventory/`, or to a file the page does not use | check with `psq capture --compare`; resolve paths via `contentFilePath` |
| the "after" video is faster but the page is broken | a referenced resource was deleted | run `psq capture --compare` before publishing the video |
| the pair is unlabelled | `-c` omitted | re-film; do not annotate afterwards in an editor, the credit is baked per frame |
| ffmpeg stacking fails on size mismatch | different device types between the two runs | both sides must come from the same recording, so `deviceType` matches |
| the video is much faster than the real site | the recording was replayed with a full-throttle command | `capture` is full-throttle; `loadshow playback` is not — check which was run |
