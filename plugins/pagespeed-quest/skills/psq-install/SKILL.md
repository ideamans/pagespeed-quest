---
name: psq-install
description: Set up a PageSpeed Quest project so the `psq` command is available, installing the pagespeed-quest npm package only if it is missing. Use when another PageSpeed Quest skill reports that `psq` cannot be found, when the user asks to install / update / upgrade PageSpeed Quest, or when starting a new speed investigation that needs a working directory to record into.
license: GPL-3.0-or-later
compatibility: Requires Node.js 22 or newer and network access to registry.npmjs.org and github.com (the postinstall step downloads the loadshow and static-webshot binaries). Chrome/Chromium is installed by the puppeteer dependency. Standalone — does NOT require psq to already be present.
allowed-tools: Bash(node:*) Bash(npm:*) Bash(npx:*) Bash(yarn:*) Bash(which:*) Bash(command:*) Bash(mkdir:*) Bash(ls:*) Bash(cat:*) Bash(test:*) Read Write
---

# psq-install

Make `psq` runnable. PageSpeed Quest is **project-scoped**, not a global
binary: each investigation lives in its own directory, next to the `inventory/`
it records and the `artifacts/` it measures into. So "installing" means having a
project directory with the package as a dev dependency.

## Workflow

### 1. Is it already available?

Run this from the directory the user wants to work in:

```bash
npx --no-install psq llm --format json >/dev/null 2>&1 && echo present || echo missing
```

If it prints `present`, stop — nothing to install. Confirm the version only
when the user asked to update:

```bash
node -p "require('./node_modules/pagespeed-quest/package.json').version"
```

Do not check npm for a newer release unless the user asked to update. It costs a
round trip and answers a question nobody asked.

### 2. Check Node.js

```bash
node -v
```

Node 22 or newer is required (`engines.node: ">=22"`). If the version is older,
stop and tell the user — do not try to install or switch Node versions on their
behalf.

### 3. Create the quest project

Ask for a directory name if the user did not give one. Something that names the
subject reads well later: `example-com-quest`.

```bash
mkdir -p example-com-quest
cd example-com-quest
npm init -y
npm install --save-dev pagespeed-quest
```

`yarn init -y && yarn add -D pagespeed-quest` works identically; follow whatever
the surrounding project already uses.

The install runs a postinstall step that downloads two helper binaries
(`loadshow`, `static-webshot`) from GitHub Releases into
`node_modules/pagespeed-quest/bin/`. It needs network access to github.com. If
that step fails, everything except video and screenshots still works.

### 4. Verify

```bash
npx psq --help
npx psq llm | head -40
```

`psq llm` prints the full agent reference for the installed version. Read it
before driving the tool — it is the manual, and it always matches the version
in this project.

### 5. Only if the registry is not an option: build from source

Last resort — it needs a Go-free but full Node toolchain and takes longer than
the registry install. Use it when the user needs an unreleased change, or when
npmjs.org is unreachable.

```bash
git clone https://github.com/ideamans/pagespeed-quest.git
cd pagespeed-quest && npm install && npm run build
```

Then reference it from the quest project as a file dependency
(`npm install --save-dev ../pagespeed-quest`) rather than linking globally, so
`inventory/` and `artifacts/` still resolve where the user expects.

### 6. Updating an existing project

```bash
npm install --save-dev pagespeed-quest@latest
```

Recordings made by an older version stay readable; the inventory format is
stable. If the helper binaries changed version, the postinstall step replaces
them.

## Notes

- **Do not install globally.** `psq` resolves Lighthouse from
  `./node_modules/.bin/lighthouse`, and writes `inventory/` and `artifacts/`
  relative to the working directory. A global install works only by accident.
- To point at binaries you already have, set `LIGHTHOUSE_PATH`, `LOADSHOW_PATH`
  or `WEBSHOT_PATH` instead of reinstalling.
- The package is GPL-3.0-or-later. Mention that if the user is embedding it in a
  product rather than using it as a tool.

## Failure modes

| Symptom | Cause | Fix |
| --- | --- | --- |
| `psq: command not found` | invoked outside the project, or a global install was assumed | run `npx psq …` from the project directory |
| postinstall fails downloading loadshow / static-webshot | no access to github.com, or an unsupported platform | Lighthouse measurement still works; set `LOADSHOW_PATH` / `WEBSHOT_PATH` to your own builds for the rest |
| `Unsupported platform` from postinstall | only darwin-arm64, linux-amd64, linux-arm64 and windows-amd64 have prebuilt helpers | build `go-loadshow` / `static-webshot` yourself and point the env vars at them |
| the install takes minutes | puppeteer downloads a Chromium build | expected on first install |
| `npx psq` resolves to a different package | the project has no local install and npx fetched something from the registry | install it as a dev dependency first; never rely on a bare `npx psq` |
| Node version error | the package requires Node ≥ 22 | ask the user to switch Node; do not change their runtime for them |
