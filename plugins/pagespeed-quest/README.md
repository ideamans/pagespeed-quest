# pagespeed-quest — Claude Code plugin

Agent Skills for [PageSpeed Quest](https://github.com/ideamans/pagespeed-quest):
freeze any public web page into a local, editable recording, replay it with its
original per-resource timing, and measure what a front-end optimization would
actually gain.

## Install

```sh
/plugin marketplace add ideamans/claude-public-plugins
/plugin install pagespeed-quest
```

The same skills work with other agents through `gh skill`:

```sh
gh skill install ideamans/pagespeed-quest/plugins/pagespeed-quest/skills/psq-usage --agent copilot
```

## Skills

| Skill | Use it when |
| --- | --- |
| `psq-install` | `psq` is missing, or a new investigation needs a project |
| `psq-usage` | running the record → baseline → edit → measure loop |
| `psq-inventory` | you need to know what to edit and what the edit will do |
| `psq-video` | the deliverable is a before/after video of the load |

All four defer to `psq llm` for the authoritative reference, which ships inside
the installed package and therefore cannot drift from it.

## Maintenance

The skills are validated by `yarn test` in the repository root
(`scripts/validate-plugin-skills.js`): five portable frontmatter fields only, a
`## Failure modes` table in each skill, and `plugin.json.version` equal to
`package.json.version`.
