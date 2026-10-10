---
name: psq-record
description: Record a public web page into a PageSpeed Quest inventory with `psq lighthouse recording` (or `psq loadshow recording`), check that the recording is complete, and freeze it as the baseline every later measurement is compared against. Use at the start of any speed investigation of a URL, when a recording has to be redone (different device, different URL, incomplete capture), or when the user asks to snapshot a page for later analysis.
license: GPL-3.0-or-later
compatibility: Requires a PageSpeed Quest project with `pagespeed-quest` installed (see psq-install) and network access to the page. Recording drives a real headless Chrome against the real site.
allowed-tools: Bash(npx:*) Bash(cp:*) Bash(mkdir:*) Bash(mv:*) Bash(ls:*) Bash(cat:*) Bash(du:*) Bash(find:*) Bash(jq:*) Read Glob Grep
---

# psq-record

Freeze one page load into `inventory/`: every response body as an editable file,
plus the per-resource latency and bandwidth needed to replay it faithfully.
Everything later in a quest is measured against this recording, so a bad
recording silently spoils every number after it.

Run `npx psq llm` for the authoritative reference of the installed version.

## Before recording

- If `npx psq --help` fails, use **psq-install**.
- Recording sends real traffic to the site from this machine. On a site the user
  does not own, confirm that is acceptable first.
- Work in the quest directory. `inventory/` and `artifacts/` are written
  relative to the working directory, and recording **overwrites** `inventory/`.

## Record

```bash
npx psq lighthouse -a ./artifacts/recording recording https://example.com/
```

| Option | Belongs to | Use |
| --- | --- | --- |
| `-d mobile\|desktop` | `recording` | device profile, stored in the inventory and reused by every playback. Default `mobile` |
| `-x <regex>` | `recording` | drop matching URLs, repeatable. For analytics and ad beacons when the subject is first-party code — **not** when the question is what the third parties cost |
| `-t <ms>` | `lighthouse` | load timeout, default 30000. Raise it for slow pages |
| `-a <dir>` | `lighthouse` | where the recording run's report goes |

Options go before the next subcommand: `-a` and `-t` before `recording`, `-d`
and `-x` after it.

Record with `psq loadshow recording <url>` instead when the deliverable is a
video (see **psq-video**) — the browser is driven the same way at record and
replay time.

### The recording run's report is not a baseline

The Lighthouse run that drives the recording measures the **live site** through
the recording proxy. Its `summary.md` has no *Traffic* section (that is computed
from a finished inventory) and its numbers are not comparable with any playback.
That is why the command above sends it to `artifacts/recording/` — keep it out
of the comparison. The baseline is measured by playback (see **psq-measure**).

## Check the recording

Before building on it, confirm it captured the page:

```bash
jq '{entryUrl, deviceType, resources: (.resources | length)}' inventory/index.json
jq -r '.resources | group_by(.statusCode)[] | "\(.[0].statusCode)\t\(length)"' inventory/index.json
jq -r '.resources[] | select(.statusCode >= 300) | "\(.statusCode)\t\(.url)"' inventory/index.json
```

Then look at the page as replayed:

```bash
npx psq capture -a ./artifacts/recording-check
```

and open `artifacts/recording-check/capture.png`. A blank or error page means
the recording is unusable, whatever the resource count says.

## Freeze the baseline

```bash
cp -r inventory baseline
cp -r inventory accepted
```

- `baseline/` is the page as recorded. **Never edit it**, never delete it. Every
  final number is relative to it.
- `accepted/` is the page with every change adopted so far. It starts equal to
  the baseline. **psq-usage** describes how trials are built from it.

Both are plain directories; `-i` points any `psq` command at either.

## When to record again

Re-record — into a new quest directory, or after moving the old directories
aside — when the entry URL or the device type has to change (`playback` reuses
both from the inventory and never takes a URL), or when the check above failed.
Do not mix measurements from two recordings in one comparison.

If an `inventory.json` exists next to `index.json` (older recordings wrote both),
delete it: `psq` reads that one for the entry URL and traffic figures while the
proxy serves `index.json`.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| a handful of resources, page blank in the capture | bot protection, a consent wall or a redirect to a login page was recorded | try `-d desktop`, or a different URL on the site; say so if the page cannot be recorded |
| the document is a 301/302 | the URL given was not the final URL | record the redirect target directly |
| `summary.md` after recording has no Traffic section | expected — it is the live run | measure the baseline by playback |
| recording times out | slow page or long-polling scripts | raise `-t`, or exclude the long-lived request with `-x` |
| recording is full of analytics and ad traffic | nothing was excluded | re-record with `-x`, unless the third parties are the subject |
| `unknown option` | an option was placed after a subcommand it does not belong to | `psq lighthouse -a ./art recording -d desktop <url>` |
| the old baseline was overwritten | recording writes `./inventory`, and a copy was made afterwards | record into a fresh quest directory; never re-record over a quest in progress |
