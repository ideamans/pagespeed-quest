---
name: regen-ai
description: Regenerate the agent-facing derived artifacts of pagespeed-quest (llmdocs/90-commands.md) from the command definitions in src/cli.ts, and validate the Agent Skills bundle under plugins/pagespeed-quest/. Use after changing a command, flag or default, after editing any llmdocs chapter or SKILL.md, after bumping the version, or before merging a branch that touches any of those.
allowed-tools: Bash(yarn *) Bash(node scripts/*) Bash(git diff*) Bash(git status*) Read Grep
license: GPL-3.0-or-later
---

# regen-ai

Regenerate, validate, and report what changed.

## Steps

1. **See what was already pending**, so the regen's own diff is distinguishable:

   ```bash
   git status --short
   ```

2. **Regenerate and validate**:

   ```bash
   yarn ai:regen
   ```

   which runs `build:module` → `build:llmdocs` → `validate-plugin-skills`, and
   rewrites `llmdocs/90-commands.md` from the actual `psq` command tree.

3. **Check the hand-written chapters still match reality.** The generator only
   refreshes the catalog. If this turn added a flag, changed a default, or
   changed an output path, the chapter that documents it needs the same edit:

   | Changed | Chapter |
   | --- | --- |
   | a rule or a trap agents hit | `llmdocs/00-guide.md` |
   | the inventory schema or layout | `llmdocs/10-inventory.md` |
   | what an edit does to the measurement | `llmdocs/20-experiments.md` |
   | artifacts, comparison, video | `llmdocs/30-measuring.md` |
   | a pitfall worth telling context7 | `context7.json` (`rules`) |
   | how an agent should drive the tool | `plugins/pagespeed-quest/skills/*/SKILL.md` |

4. **Run the suite**:

   ```bash
   yarn test
   ```

   `test:llmdocs` fails if the catalog is stale, `test:plugins` fails on skill
   frontmatter drift or a `plugin.json` version mismatch.

5. **Report**: which generated files changed, whether the chapters needed a
   matching edit, and the test outcome.

## Notes

- `llmdocs/90-commands.md` is committed (context7 crawls the repository, so it
  has to exist in git) but it is a derived file. Never fix a test failure by
  editing it — fix `src/cli.ts` and regenerate.
- Bumping `package.json.version` requires bumping
  `plugins/pagespeed-quest/.claude-plugin/plugin.json` in the same commit.
- Node 22.19 or newer is required to install and build (Lighthouse 13's floor).
