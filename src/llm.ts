import Fs from 'fs'
import Fsp from 'fs/promises'
import Path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = Path.dirname(__filename)

/**
 * Directory holding the single source of knowledge served to AI agents.
 *
 * The Markdown files are shipped with the npm package (see the `files` field in
 * package.json) so that `psq llm` works offline and always matches the version
 * of the package that is installed. They are also what context7 crawls.
 */
export const LlmDocsDir = Path.resolve(__dirname, '..', 'llmdocs')

/** Version of the installed package, used by `psq --version`. */
export function packageVersion(): string {
  const packageJsonPath = Path.resolve(__dirname, '..', 'package.json')
  const packageJson = JSON.parse(Fs.readFileSync(packageJsonPath, 'utf8'))
  return packageJson.version as string
}

export interface LlmDocChapter {
  /** File name without the numeric prefix and extension, e.g. `guide` */
  name: string
  /** First level-1 heading of the chapter */
  title: string
  /** Markdown body, heading included */
  content: string
}

function titleOf(markdown: string, fallback: string): string {
  const heading = markdown.split(/\r?\n/).find((line) => line.startsWith('# '))
  return heading ? heading.slice(2).trim() : fallback
}

export async function loadLlmDocs(dir: string = LlmDocsDir): Promise<LlmDocChapter[]> {
  const entries = await Fsp.readdir(dir)
  const files = entries.filter((name) => name.endsWith('.md')).sort()

  const chapters: LlmDocChapter[] = []
  for (const file of files) {
    const content = await Fsp.readFile(Path.join(dir, file), 'utf8')
    const name = Path.basename(file, '.md').replace(/^\d+-/, '')
    chapters.push({ name, title: titleOf(content, name), content: content.trimEnd() })
  }

  return chapters
}

export async function renderLlmDocs(format: 'markdown' | 'json' = 'markdown', dir?: string): Promise<string> {
  const chapters = await loadLlmDocs(dir)
  if (format === 'json') return `${JSON.stringify(chapters, null, 2)}\n`
  return `${chapters.map((chapter) => chapter.content).join('\n\n---\n\n')}\n`
}
