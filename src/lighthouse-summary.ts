import fs from 'fs/promises'
import Path from 'path'

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
  { id: 'first-contentful-paint', abbr: 'FCP', unit: 'ms', weight: 0.1 },
  { id: 'largest-contentful-paint', abbr: 'LCP', unit: 'ms', weight: 0.25 },
  { id: 'total-blocking-time', abbr: 'TBT', unit: 'ms', weight: 0.3 },
  { id: 'cumulative-layout-shift', abbr: 'CLS', unit: '', weight: 0.25 },
  { id: 'speed-index', abbr: 'SI', unit: 'ms', weight: 0.1 },
]

export interface GenerateLighthouseSummaryInput {
  jsonPath: string
  outputPath: string
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
  lines.push(`- Overall ${formatScore(overallScore)}`)

  for (const metric of PERFORMANCE_METRICS) {
    const audit = report.audits[metric.id]
    if (audit) {
      const score = formatScore(audit.score)
      const weight = `x${metric.weight.toFixed(2)}`
      lines.push(`- ${metric.abbr} ${score} ${weight}`)
    }
  }

  lines.push('')

  // Ensure output directory exists
  const outputDir = Path.dirname(opts.outputPath)
  await dependency.mkdirp(outputDir)

  // Write the summary file
  await fs.writeFile(opts.outputPath, lines.join('\n'), 'utf-8')

  dependency.logger?.info(`Lighthouse summary saved to ${opts.outputPath}`)
}
