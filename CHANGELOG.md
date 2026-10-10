# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### Unreleased

* Restructure the Agent Skills bundle around a whole investigation of a URL. `psq-usage` now runs record → measure → investigate → one change per trial → adopt or reject → report, with `baseline/` (never edited), `accepted/` (adopted changes) and a `quest-log.md`; new `psq-record` (recording, checking it, freezing the baseline) and `psq-measure` (several runs per state with medians and spread, reading `lighthouse.report.json` for the LCP element, waterfall, script cost and third parties, screenshot diffs)
* The skills and `llmdocs/20-experiments.md` no longer prescribe optimizations; they cover how an edit reaches the replay and what cannot be modelled, and leave the choice of changes to the agent
* Document that the report written by `psq lighthouse recording` measured the live site and must not be used as the baseline
* Fix the documented inventory layout: method directories are lower-case (`contents/get/…`), queries are URL-encoded before the extension, and `contentFilePath` is relative to the inventory directory
* Document that `method`, `url` and `ttfbMs` are required when adding a resource to `index.json`

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
