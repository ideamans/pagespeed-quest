import test from 'ava'

import { createProgram } from './cli.js'
import { loadLlmDocs, packageVersion, renderLlmDocs } from './llm.js'

test('llmdocs ships the chapters agents rely on', async (t) => {
  const chapters = await loadLlmDocs()
  const names = chapters.map((chapter) => chapter.name)

  t.deepEqual(names, ['guide', 'inventory', 'experiments', 'measuring', 'commands'])
  for (const chapter of chapters) {
    t.true(chapter.title.length > 0, `${chapter.name} has no level-1 heading`)
    t.true(chapter.content.length > 200, `${chapter.name} is suspiciously short`)
  }
})

test('the guide keeps the rules agents get wrong', async (t) => {
  const [guide] = await loadLlmDocs()

  // These are the traps the reference exists for. If a heading or a rule is
  // renamed, this fails on purpose — update the skills at the same time.
  t.true(guide.content.includes('## Failure modes'))
  t.true(guide.content.includes('Unmatched requests get a 404'))
  t.true(guide.content.includes('playback` takes no URL'))
})

test('markdown and json render the same chapters', async (t) => {
  const markdown = await renderLlmDocs('markdown')
  const parsed = JSON.parse(await renderLlmDocs('json'))

  t.true(markdown.startsWith('# pagespeed-quest'))
  t.is(parsed.length, (await loadLlmDocs()).length)
})

test('the command catalog covers every subcommand', async (t) => {
  const chapters = await loadLlmDocs()
  const catalog = chapters.find((chapter) => chapter.name === 'commands')
  t.truthy(catalog)

  for (const command of createProgram().commands) {
    if (command.name() === 'help') continue
    t.true(catalog!.content.includes(`psq ${command.name()}`), `${command.name()} is missing from the catalog`)
  }
})

test('the CLI version matches the package', (t) => {
  t.is(createProgram().version(), packageVersion())
})
