---
paths:
  - 'src/cli.ts'
  - 'src/command.ts'
  - 'src/llm.ts'
  - 'llmdocs/**'
  - 'plugins/pagespeed-quest/**'
  - 'context7.json'
  - 'package.json'
---

# Regen triggers

You are editing a file that feeds the agent-facing artifacts. When this turn
changes any of the paths above:

1. **Regenerate before committing**: `/regen-ai`, or `yarn ai:regen` directly.
   It rebuilds `llmdocs/90-commands.md` from the command tree and validates the
   skill bundle.
2. **Never edit `llmdocs/90-commands.md` by hand.** Change the command
   definitions in `src/cli.ts` and regenerate. `yarn test` fails on a stale
   catalog.
3. **If you added or changed a command, flag or default**, update the hand-written
   chapters too — the catalog only carries help text. The rules an agent gets
   wrong live in `llmdocs/00-guide.md`, and the pitfalls list in
   `context7.json` mirrors it.
4. **If you bumped `package.json.version`**, bump
   `plugins/pagespeed-quest/.claude-plugin/plugin.json` to match, or the
   validator fails.
5. **Run `yarn test`** and surface anything newly failing before moving on.

See `.claude/rules/ai-artifacts-policy.md` for the source-to-artifact map.
