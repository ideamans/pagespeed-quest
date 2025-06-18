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

1. **Proxy System** (`proxy.ts`, `recording.ts`, `playback.ts`):
   - HTTP proxy server that intercepts and records/replays web traffic
   - Uses http-mitm-proxy for SSL interception
   - Recording captures all resources with timing metadata
   - Playback reproduces network conditions and resource delivery

2. **Inventory Management** (`inventory.ts`):
   - Stores recorded resources as files on disk
   - Format: `inventory/[method]/[protocol]/[hostname]/[...path]`
   - Metadata stored in `inventory/index.json`
   - Supports file watching for live updates during playback

3. **Performance Tools Integration**:
   - **Lighthouse** (`lighthouse.ts`): Runs Google Lighthouse through the proxy
   - **Loadshow** (`loadshow.ts`): Creates videos of page load process
   - Both tools can work in recording or playback mode

4. **Network Simulation** (`throttling.ts`):
   - Reproduces original network timing during playback
   - Simulates latency and throughput constraints

5. **Dependency Injection** (`dependency.ts`):
   - Central container for managing service dependencies
   - Allows easy mocking and testing

### CLI Command Structure
The `psq` command has three main subcommands:
- `lighthouse [recording|playback]` - Performance testing with Lighthouse
- `loadshow [recording|playback]` - Video generation with loadshow  
- `proxy` - Standalone proxy server

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