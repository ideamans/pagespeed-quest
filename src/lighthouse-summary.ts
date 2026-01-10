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
  inventoryDir?: string
  resources?: Resource[]
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
  trafficSize: number // Compressed/transferred size
  resourceSize: number // Decompressed/original size
}

/**
 * Maps MIME type to resource type category
 */
function getResourceType(mime: string | undefined): ResourceType {
  if (!mime) return 'other'
  if (mime.includes('html')) return 'document'
  if (mime.includes('css')) return 'stylesheet'
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
 * Calculates traffic statistics by resource type
 */
async function calculateResourceStats(
  resources: Resource[],
  inventoryDir: string
): Promise<{ stats: ResourceTypeStats[]; totals: { trafficSize: number; resourceSize: number } }> {
  const statsMap = new Map<ResourceType, ResourceTypeStats>()

  // Initialize all resource types
  const types: ResourceType[] = ['document', 'stylesheet', 'script', 'image', 'font', 'other']
  for (const type of types) {
    statsMap.set(type, { type, count: 0, trafficSize: 0, resourceSize: 0 })
  }

  for (const resource of resources) {
    if (!resource.contentFilePath) continue

    const type = getResourceType(resource.contentTypeMime)
    const stat = statsMap.get(type)!

    try {
      const filePath = Path.join(inventoryDir, resource.contentFilePath)
      const fileStat = await fs.stat(filePath)
      const resourceSize = fileStat.size

      // Traffic size: if content-encoding exists, estimate compressed size
      // Otherwise use resource size
      // Note: The file is stored decompressed, so we estimate traffic size
      // based on typical compression ratios for each type
      let trafficSize = resourceSize
      if (resource.contentEncoding) {
        // For compressed resources, estimate traffic size based on typical ratios
        // These are rough estimates - actual values would require re-compression
        const compressionRatios: Record<ResourceType, number> = {
          document: 0.2,
          stylesheet: 0.15,
          script: 0.25,
          image: 0.95, // Images are usually already compressed
          font: 0.7,
          other: 0.5,
        }
        trafficSize = Math.round(resourceSize * compressionRatios[type])
      }

      stat.count++
      stat.trafficSize += trafficSize
      stat.resourceSize += resourceSize
    } catch {
      // File not found or other error - skip
    }
  }

  // Filter out types with no resources and sort by fixed order
  const typeOrder: ResourceType[] = ['document', 'stylesheet', 'script', 'image', 'font', 'other']
  const stats = Array.from(statsMap.values())
    .filter((s) => s.count > 0)
    .sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type))

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
  if (opts.resources && opts.inventoryDir) {
    const { stats, totals } = await calculateResourceStats(opts.resources, opts.inventoryDir)

    if (stats.length > 0) {
      // Traffic section (compressed/transferred size)
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

      // Resource section (decompressed/original size)
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
