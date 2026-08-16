# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PageSpeed Quest is a TypeScript-based web performance testing framework that records and replays web page resources through an HTTP proxy. It integrates with Google Lighthouse and loadshow to measure and visualize web performance improvements.

## Development Commands

### Build
```bash
yarn build              # Build all TypeScript files to build/
yarn build:module       # Build TypeScript only
yarn watch:build        # Watch mode for development
```

### Testing
```bash
yarn test               # Run all tests (build, lint, prettier, unit tests)
yarn test:unit          # Run unit tests only with AVA
yarn test:lint          # Run ESLint
yarn test:prettier      # Check code formatting
yarn watch:test         # Watch mode for tests
```

### Code Quality
```bash
yarn fix                # Fix all (prettier and lint)
yarn fix:prettier       # Format code with Prettier
yarn fix:lint           # Fix ESLint issues
```

### Coverage
```bash
yarn cov                # Generate and open coverage report
yarn cov:check          # Check if coverage meets thresholds (100%)
```

### CLI Testing
```bash
yarn command            # Build and run CLI locally
yarn adhoc              # Run adhoc.js for development testing
```

## Architecture

### Module Organization
The codebase follows a modular architecture with clear separation of concerns:

1. **Proxy System** (`recording.ts`, `playback.ts`):
   - HTTP proxy server that intercepts and records/replays web traffic
   - Uses **rust-http-playback-proxy** (Rust-based native module) for high performance
   - Recording captures all resources with timing metadata
   - Playback reproduces network conditions and resource delivery with ±10% timing accuracy
   - TypeScript wrappers provide clean integration with the Rust proxy

2. **Inventory Management** (`inventory.ts`):
   - Stores recorded resources as files on disk
   - Format: `inventory/[method]/[protocol]/[hostname]/[...path]`
   - Metadata stored in `inventory/inventory.json` (Rust proxy format) and `inventory/index.json` (legacy format)
   - Supports file watching for live updates during playback
   - Automatically beautifies minified HTML/CSS/JS for readability

3. **Performance Tools Integration**:
   - **Lighthouse** (`lighthouse.ts`): Runs Google Lighthouse through the proxy
   - **Loadshow** (`loadshow.ts`): Creates videos of page load process
   - **Webshot** (`webshot.ts`): Captures screenshots and generates visual diffs via `static-webshot`
   - Lighthouse and Loadshow can work in recording or playback mode
   - Capture (webshot) works in playback mode only with full-throttle (no timing simulation)
   - Lighthouse throttling is disabled as timing is handled by the Rust proxy

4. **Dependency Injection** (`dependency.ts`):
   - Central container for managing service dependencies
   - Allows easy mocking and testing

### CLI Command Structure
The command tree is built in `src/cli.ts` (`createProgram()`); `src/command.ts`
is only the bin entry point. Keeping the tree in an exported function is what
lets `scripts/build-llm-docs.js` generate the command catalog instead of anyone
maintaining it by hand.

The `psq` command has five subcommands:
- `lighthouse [recording|playback]` - Performance testing with Lighthouse
- `loadshow [recording|playback]` - Video generation with loadshow
- `capture` - Screenshot capture via playback proxy (full-throttle) with optional visual diff (`--compare <file>`)
- `proxy` - Standalone proxy server with optional recording mode (`--record <url>`) and file watching in playback mode
- `llm` - Print the embedded agent reference (`--format markdown|json`)

### LLM knowledge (`llmdocs/`)
`llmdocs/*.md` is the single source of knowledge served to AI agents. It ships
with the npm package (`files` includes `llmdocs`), so `psq llm` works offline
and always matches the installed version, and context7 crawls the same
directory. `90-commands.md` is generated — see below.

### Testing Strategy
- Unit tests use AVA framework with NYC for coverage
- Test files are colocated with source files (`.spec.ts`)
- 100% coverage requirement enforced
- Tests run compiled JavaScript from `build/` directory

## Code Style

### TypeScript Configuration
- Target: ESNext with ESM modules
- No strict mode enabled
- Source maps inline for debugging
- Declaration files generated

### Formatting Rules (Prettier)
- Single quotes for strings
- No semicolons
- Line width: 120 characters
- Applied to all `.ts` files in `src/`

### Linting
- ESLint with TypeScript parser
- Prettier integration for consistent formatting
- Checks for unused variables and implicit returns

## Important Patterns

### Error Handling
- Use `pino` logger for consistent logging
- Set `LOG_LEVEL` environment variable (default: error in tests)

### File Path Handling
- All inventory paths are relative to the inventory directory
- Use forward slashes even on Windows for consistency
- Resource paths preserve the original URL structure

### Async Operations
- Heavy use of async/await throughout
- Proxy operations are inherently asynchronous
- File operations use promises (fs/promises)

### Type Safety
- Even without strict mode, maintain proper typing
- Export types from `types.ts` for shared interfaces
- Use type guards where necessary

## When you change behaviour, update all three

A change to a command, a flag, a default, an output path or an exit code is not
finished until three things are updated:

| | Target |
| --- | --- |
| ① Documentation | `README.md` / `README.ja.md`, `CHANGELOG.md` |
| ② Help | the `.description()` / `.option()` strings in `src/cli.ts` |
| ③ **LLM knowledge** | `llmdocs/`, `context7.json` rules, `plugins/pagespeed-quest/skills/*/SKILL.md`, this file |

**Stale ① and ② get reported by humans within a day. Stale ③ is silent** —
agents just quietly do the wrong thing, and the only symptom is "somehow it
doesn't work well". So do not leave ③ for later.

Rules of thumb:

- new command or flag → ② and regenerate the catalog; if the usage is
  non-obvious, add it to the relevant `llmdocs` chapter as well
- changed default, output path or exit code → ①②③
- found a trap agents fall into → `llmdocs/00-guide.md` failure modes and
  `context7.json` `rules`
- added something destructive → say so in the skill that would invoke it

Details: `.claude/rules/ai-artifacts-policy.md`, and the company standard at
<https://github.com/ideamans/go-llm-cli-kit/blob/main/LLM.md>.

### Generated files

`llmdocs/90-commands.md` is generated from the command tree by
`scripts/build-llm-docs.js`. Never edit it by hand — change `src/cli.ts` and run
`yarn ai:regen`. `yarn test` fails on a stale catalog (`test:llmdocs`) and on
skill frontmatter or version drift (`test:plugins`).

### Versioning and release

`plugins/pagespeed-quest/.claude-plugin/plugin.json` must carry the same version
as `package.json`; the validator enforces it. Publishing to npm happens on a
`v*` tag push, and the workflow refuses to publish if the tag and
`package.json.version` disagree.

### Node version

Node **22.19 or newer** — Lighthouse 13's floor, and what `engines.node`
declares. The test runner (`@ava/typescript` 7) needs 22.20+, so
`.node-version` and `.tool-versions` pin 22.23.1. CI runs 22.x and 24.x.
