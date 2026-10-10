# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### 0.12.0 (2026-10-11)

* **Lighthouse now reports the replay as observed** (`--throttling-method=provided`, plus `--throttling.requestLatencyMs=0`). Until now Lighthouse ran with its default `simulate` method, which re-derives every metric from its own network model and ignores the timing the proxy reproduces — reported FCP could even be shorter than the document's TTFB, and repeated runs of one recording disagreed by hundreds of milliseconds. **Scores and metrics change, and are not comparable with earlier versions.** A playback run now takes roughly 20–30 seconds, because Lighthouse waits for the page to go quiet
* Restructure the Agent Skills bundle around a whole investigation of a URL. `psq-usage` now runs record → measure → investigate → one change per trial → adopt or reject → report, with `baseline/` (never edited), `accepted/` (adopted changes) and a `quest-log.md`; new `psq-record` (recording, checking it, freezing the baseline) and `psq-measure` (several runs per state with medians and spread, reading `lighthouse.report.json` for the LCP element, waterfall, script cost and third parties, screenshot diffs)
* The skills and `llmdocs/20-experiments.md` no longer prescribe optimizations; they cover how an edit reaches the replay and what cannot be modelled, and leave the choice of changes to the agent
* Document that the report written by `psq lighthouse recording` measured the live site and must not be used as the baseline
* Fix the documented inventory layout: method directories are lower-case (`contents/get/…`), queries are URL-encoded before the extension, and `contentFilePath` is relative to the inventory directory
* Document that `method`, `url` and `ttfbMs` are required when adding a resource to `index.json`
* **Bundle rust-http-playback-proxy 0.11.1.** Recordings now carry `formatVersion: 2`: a resource you did not edit replays byte for byte as the site sent it, in the recorded time, and an edited one takes time proportional to its size on the wire at the recorded per-resource speed. Shrinking a file finally makes it arrive sooner. HTML is stored as recorded instead of reformatted, and the bytes that went over the wire are kept in `inventory/originals/` — do not edit them or the `original` field. Recordings made with earlier versions still replay as before (recorded duration whatever the size); re-record them to get size-proportional timing
* The *Traffic* table in `summary.md` is now what the browser received in the run (Lighthouse's `network-requests`), not an estimate from fixed compression ratios; *Resource* is the decoded size from the same source
* Windows (x64) gets a playback proxy built for this release; until now the npm package carried a v0.3.0 binary. **Intel Macs are no longer supported**: postinstall stops with `Unsupported platform` instead of downloading arm64 binaries that cannot run there
* Fix the documentation of inline `contentUtf8` / `contentBase64`: they are used only when there is no `contentFilePath`, not in preference to the file

### 0.11.0 (2026-08-16)

* Add `psq llm` — the embedded reference for AI agents (`--format markdown|json`), sourced from `llmdocs/` and shipped with the package
* Add `psq --version`
* Ship an Agent Skills bundle (`plugins/pagespeed-quest/`): `psq-install`, `psq-usage`, `psq-inventory`, `psq-video`, installable through the ideamans Claude Code marketplace or `gh skill`
* Add `context7.json` so agents with the context7 MCP server can look the project up
* Generate `llmdocs/90-commands.md` from the actual command tree (`yarn ai:regen`), and fail the test suite when it is stale or when the skill bundle drifts
* Extract the command tree into `src/cli.ts` (`createProgram()`); `src/command.ts` is now only the bin entry point
* Publish to npm on a `v*` tag push instead of on every push to `main`, verifying the tag against `package.json` and the plugin manifest
* Require Node.js 22.19 or newer (Lighthouse 13's floor); CI runs 22.x and 24.x

### 0.2.1 (2024-09-11)
