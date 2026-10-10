#!/usr/bin/env node
/**
 * Validate the Agent Skills bundle under plugins/pagespeed-quest/.
 *
 * The distributed SKILL.md files are read by Claude Code, `gh skill` and other
 * agents, so they are held to the ideamans LLM CLI standard:
 *
 *   - exactly the five portable frontmatter fields, no Claude-specific ones
 *   - `name` matching the directory
 *   - a `## Failure modes` table at the end
 *   - an install skill in the bundle
 *   - plugin.json version identical to package.json version
 *
 * Run via `yarn test` (as test:plugins) or `yarn validate-plugin-skills`.
 */

import { readFileSync, readdirSync, existsSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const pluginDir = join(projectRoot, 'plugins', 'pagespeed-quest')
const skillsDir = join(pluginDir, 'skills')

const ALLOWED_FIELDS = ['name', 'description', 'license', 'compatibility', 'allowed-tools']
const REQUIRED_FIELDS = ['name', 'description']

const errors = []

function fail(message) {
  errors.push(message)
}

function parseFrontmatter(text, where) {
  if (!text.startsWith('---\n')) {
    fail(`${where}: missing YAML frontmatter`)
    return {}
  }
  const end = text.indexOf('\n---\n', 3)
  if (end < 0) {
    fail(`${where}: unterminated frontmatter`)
    return {}
  }
  const fields = {}
  for (const line of text.slice(4, end).split('\n')) {
    const match = line.match(/^([A-Za-z-]+):\s*(.*)$/)
    if (match) fields[match[1]] = match[2]
  }
  return fields
}

const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'))
const pluginJson = JSON.parse(readFileSync(join(pluginDir, '.claude-plugin', 'plugin.json'), 'utf8'))

if (pluginJson.version !== packageJson.version) {
  fail(`plugin.json version ${pluginJson.version} does not match package.json version ${packageJson.version}`)
}

if (!existsSync(skillsDir)) {
  fail('plugins/pagespeed-quest/skills does not exist')
}

const skillNames = existsSync(skillsDir)
  ? readdirSync(skillsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  : []

if (skillNames.length < 2) {
  fail('a distributed plugin needs at least an install skill and a usage skill')
}

if (!skillNames.some((name) => name.endsWith('-install'))) {
  fail('no install skill found — every distributed plugin ships one')
}

if (!skillNames.some((name) => name.endsWith('-usage'))) {
  fail('no usage skill found — every distributed plugin ships one')
}

for (const skillName of skillNames) {
  const where = `skills/${skillName}/SKILL.md`
  const path = join(skillsDir, skillName, 'SKILL.md')

  if (!existsSync(path)) {
    fail(`${where}: missing`)
    continue
  }

  const text = readFileSync(path, 'utf8')
  const fields = parseFrontmatter(text, where)

  for (const field of Object.keys(fields)) {
    if (!ALLOWED_FIELDS.includes(field)) {
      fail(`${where}: frontmatter field "${field}" is not portable across agents — remove it`)
    }
  }
  for (const field of REQUIRED_FIELDS) {
    if (!fields[field]) fail(`${where}: frontmatter field "${field}" is required`)
  }
  if (fields.name && fields.name !== skillName) {
    fail(`${where}: name "${fields.name}" does not match its directory "${skillName}"`)
  }
  if (fields.description && fields.description.length > 1024) {
    fail(`${where}: description is ${fields.description.length} characters, the limit is 1024`)
  }
  if (!text.includes('\n## Failure modes\n')) {
    fail(`${where}: no "## Failure modes" section — agents need the failure table`)
  }
}

if (errors.length > 0) {
  process.stderr.write(`plugin skill validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}\n`)
  process.exit(1)
}

process.stdout.write(`plugin skills OK (${skillNames.sort().join(', ')}) at version ${pluginJson.version}\n`)
