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
| `psq-usage` | the user wants a page made faster: the whole record → measure → investigate → trial → adopt → report loop |
| `psq-install` | `psq` is missing, or a new investigation needs a project |
| `psq-record` | recording a page and freezing the baseline |
| `psq-measure` | measuring a state several times, finding where the time goes, checking the page still renders |
| `psq-inventory` | you need to know how an edit to the recording reaches the replay |
| `psq-video` | the deliverable is a before/after video of the load |

The skills cover how to drive the tool; which optimizations to try is left to
the agent. All six defer to `psq llm` for the authoritative reference, which ships inside
the installed package and therefore cannot drift from it.

## Maintenance

The skills are validated by `yarn test` in the repository root
(`scripts/validate-plugin-skills.js`): five portable frontmatter fields only, a
`## Failure modes` table in each skill, and `plugin.json.version` equal to
`package.json.version`.
