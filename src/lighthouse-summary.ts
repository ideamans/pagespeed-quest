import fs from 'fs/promises'
import Path from 'path'

import { Resource } from './inventory.js'
import { DependencyInterface } from './types.js'

/**
 * Lighthouse audit result structure
 */
export interface LighthouseAudit {
  id: string
  title: string
  score: number | null
  numericValue?: number
  displayValue?: string
  details?: { items?: unknown[] }
}

/**
 * Lighthouse JSON report structure (partial)
 */
export interface LighthouseReport {
  categories: {
    performance: {
      id: string
      title: string
      score: number | null
    }
  }
  audits: Record<string, LighthouseAudit>
}

/**
 * Performance metrics to extract from Lighthouse report
 * Weights are based on Lighthouse v10+ scoring
 */
const PERFORMANCE_METRICS = [
  { id: 'largest-contentful-paint', abbr: 'LCP', unit: 'ms', weight: 0.25 },
  { id: 'cumulative-layout-shift', abbr: 'CLS', unit: '', weight: 0.25 },
  { id: 'total-blocking-time', abbr: 'TBT', unit: 'ms', weight: 0.3 },
  { id: 'first-contentful-paint', abbr: 'FCP', unit: 'ms', weight: 0.1 },
  { id: 'speed-index', abbr: 'SI', unit: 'ms', weight: 0.1 },
]

export interface GenerateLighthouseSummaryInput {
  jsonPath: string
  outputPath: string
  // Present for playback runs only; the Traffic and Resource sections are
  // written when it is given
  resources?: Resource[]
}

/**
 * The fields of a Lighthouse `network-requests` item used here
 */
interface NetworkRequestItem {
  url?: string
  resourceType?: string
  mimeType?: string
  transferSize?: number
  resourceSize?: number
}

/**
 * Resource type categories for traffic breakdown
 */
type ResourceType = 'document' | 'stylesheet' | 'script' | 'image' | 'font' | 'other'

/**
 * Traffic statistics by resource type
 */
interface ResourceTypeStats {
  type: ResourceType
  count: number
  trafficSize: number // Bytes received, including headers
  resourceSize: number // Decoded body size
}

/**
 * Maps a Lighthouse request to a resource type category
 */
function getResourceType(resourceType: string | undefined, mime: string | undefined): ResourceType {
  switch (resourceType) {
    case 'Document':
      return 'document'
    case 'Stylesheet':
      return 'stylesheet'
    case 'Script':
      return 'script'
    case 'Image':
      return 'image'
    case 'Font':
      return 'font'
  }
  if (!mime) return 'other'
  if (mime.includes('html')) return 'document'
  if (mime.includes('css')) return 'stylesheet'
  // cspell:ignore ecmascript
  if (mime.includes('javascript') || mime.includes('ecmascript')) return 'script'
  if (mime.startsWith('image/')) return 'image'
  if (mime.includes('font') || mime.includes('woff') || mime.includes('ttf') || mime.includes('otf')) return 'font'
  return 'other'
}

/**
 * Formats bytes to human-readable string (KB, MB, etc.)
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Calculates traffic statistics by resource type from what the browser
 * actually received in this run (Lighthouse's `network-requests` audit)
 */
function calculateResourceStats(report: LighthouseReport): {
  stats: ResourceTypeStats[]
  totals: { trafficSize: number; resourceSize: number }
} {
  const statsMap = new Map<ResourceType, ResourceTypeStats>()

  // Initialize all resource types
  const types: ResourceType[] = ['document', 'stylesheet', 'script', 'image', 'font', 'other']
  for (const type of types) {
    statsMap.set(type, { type, count: 0, trafficSize: 0, resourceSize: 0 })
  }

  const items = (report.audits?.['network-requests']?.details?.items ?? []) as NetworkRequestItem[]
  for (const item of items) {
    // data: and blob: URLs never crossed the network
    if (!item.url || !/^https?:/.test(item.url)) continue

    const stat = statsMap.get(getResourceType(item.resourceType, item.mimeType))
    if (!stat) continue

    stat.count++
    stat.trafficSize += item.transferSize ?? 0
    stat.resourceSize += item.resourceSize ?? 0
  }

  // Filter out types with no resources and sort by fixed order
  const stats = types.map((type) => statsMap.get(type) as ResourceTypeStats).filter((s) => s.count > 0)

  const totals = stats.reduce(
    (acc, s) => ({
      trafficSize: acc.trafficSize + s.trafficSize,
      resourceSize: acc.resourceSize + s.resourceSize,
    }),
    { trafficSize: 0, resourceSize: 0 }
  )

  return { stats, totals }
}

/**
 * Formats a score as a percentage integer
 */
function formatScore(score: number | null): string {
  if (score === null) return 'N/A'
  return `${Math.round(score * 100)}`
}

/**
 * Formats a numeric value in milliseconds (rounded to integer)
 * For CLS, returns the raw value with 3 decimal places
 */
function formatValue(numericValue: number | undefined, unit: string): string {
  if (numericValue === undefined) return 'N/A'
  if (unit === '') {
    // CLS - no unit, show decimal value
    return numericValue.toFixed(3)
  }
  // Time-based metrics - round to integer ms
  return `${Math.round(numericValue)} ${unit}`
}

/**
 * Generates a Markdown summary from a Lighthouse JSON report
 */
export async function generateLighthouseSummary(
  opts: GenerateLighthouseSummaryInput,
  dependency: Pick<DependencyInterface, 'logger' | 'mkdirp'>
): Promise<void> {
  // Read and parse the Lighthouse JSON report
  const jsonContent = await fs.readFile(opts.jsonPath, 'utf-8')
  const report: LighthouseReport = JSON.parse(jsonContent)

  // Extract overall performance score
  const overallScore = report.categories?.performance?.score

  // Build the Markdown content
  const lines: string[] = []

  lines.push('# Lighthouse Performance Summary')
  lines.push('')

  // Section 1: Metric Values
  lines.push('## Metrics')
  lines.push('')

  for (const metric of PERFORMANCE_METRICS) {
    const audit = report.audits[metric.id]
    if (audit) {
      const value = formatValue(audit.numericValue, metric.unit)
      lines.push(`- ${metric.abbr} ${value}`)
    }
  }

  lines.push('')

  // Section 2: Scores
  lines.push('## Scores')
  lines.push('')

  for (const metric of PERFORMANCE_METRICS) {
    const audit = report.audits[metric.id]
    if (audit) {
      const score = formatScore(audit.score)
      const weight = `x${metric.weight.toFixed(2)}`
      lines.push(`- ${metric.abbr} ${score} ${weight}`)
    }
  }
  lines.push(`- **Overall** ${formatScore(overallScore)}`)

  lines.push('')

  // Section 3: Resource Traffic (if inventory data is provided)
  if (opts.resources) {
    const { stats, totals } = calculateResourceStats(report)

    if (stats.length > 0) {
      // Traffic section (bytes received, after compression and headers)
      lines.push('## Traffic: Type / Count / Size / Bytes')
      lines.push('')
      for (const stat of stats) {
        lines.push(`- ${stat.type} / ${stat.count} / ${formatBytes(stat.trafficSize)} / ${stat.trafficSize}`)
      }
      lines.push(
        `- **total** / ${stats.reduce((sum, s) => sum + s.count, 0)} / ${formatBytes(totals.trafficSize)} / ${
          totals.trafficSize
        }`
      )
      lines.push('')

      // Resource section (decoded body size)
      lines.push('## Resource: Type / Count / Size / Bytes')
      lines.push('')
      for (const stat of stats) {
        lines.push(`- ${stat.type} / ${stat.count} / ${formatBytes(stat.resourceSize)} / ${stat.resourceSize}`)
      }
      lines.push(
        `- **total** / ${stats.reduce((sum, s) => sum + s.count, 0)} / ${formatBytes(totals.resourceSize)} / ${
          totals.resourceSize
        }`
      )
      lines.push('')
    }
  }

  // Ensure output directory exists
  const outputDir = Path.dirname(opts.outputPath)
  await dependency.mkdirp(outputDir)

  // Write the summary file
  await fs.writeFile(opts.outputPath, lines.join('\n'), 'utf-8')

  dependency.logger?.info(`Lighthouse summary saved to ${opts.outputPath}`)
}
