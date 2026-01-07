import Path from 'path'

import { captureLighthouseDigest } from './lighthouse-digest.js'
import { generateLighthouseSummary } from './lighthouse-summary.js'
import { DependencyInterface, DeviceType } from './types.js'

export interface ExecLighthouseInput {
  url: string
  proxyPort: number
  deviceType?: DeviceType
  view?: boolean
  artifactsDir?: string
  headless: boolean
  timeout: number
  captureScoreAndMetrics?: boolean
}

export async function execLighthouse(
  opts: ExecLighthouseInput,
  dependency: Pick<DependencyInterface, 'mkdirp' | 'executeLighthouse' | 'logger'>
): Promise<void> {
  const artifactsDir = opts.artifactsDir || './artifacts'
  await dependency.mkdirp(artifactsDir)

  const deviceType = opts.deviceType || 'mobile'
  const outputPath = Path.join(artifactsDir, 'lighthouse')
  const args: string[] = [
    opts.url,
    '--save-assets',
    '--output=html,json',
    `--output-path=${outputPath}`,
    '--only-categories=performance',
    `--form-factor=${deviceType}`,
    // Set screen emulation to match form factor
    `--screenEmulation.mobile=${deviceType === 'mobile' ? 'true' : 'false'}`,
    // Disable throttling as Rust proxy handles timing accurately
    '--throttling.rttMs=0',
    '--throttling.throughputKbps=0',
    '--throttling.downloadThroughputKbps=0',
    '--throttling.uploadThroughputKbps=0',
    '--throttling.cpuSlowdownMultiplier=1',
  ]

  args.push(`--max-wait-for-load=${opts.timeout}`)

  const chromeFlags: string[] = ['--ignore-certificate-errors', `--proxy-server=http://localhost:${opts.proxyPort}`]
  if (opts.headless) chromeFlags.push('--headless')
  args.push(`--chrome-flags="${chromeFlags.join(' ')}"`)

  if (opts.view) args.push('--view')

  await dependency.executeLighthouse(args)

  // Capture score and metrics screenshot if requested
  if (opts.captureScoreAndMetrics !== false) {
    const htmlPath = `${outputPath}.report.html`
    const digestPath = Path.join(artifactsDir, 'lighthouse.digest.png')

    try {
      await captureLighthouseDigest(
        {
          htmlPath,
          outputPath: digestPath,
        },
        dependency
      )
    } catch (error) {
      dependency.logger?.warn(`Failed to capture Lighthouse score and metrics: ${error}`)
    }
  }

  // Generate summary markdown
  if (opts.artifactsDir) {
    const jsonPath = `${outputPath}.report.json`
    const summaryPath = Path.join(artifactsDir, 'summary.md')

    try {
      await generateLighthouseSummary(
        {
          jsonPath,
          outputPath: summaryPath,
        },
        dependency
      )
    } catch (error) {
      dependency.logger?.warn(`Failed to generate Lighthouse summary: ${error}`)
    }
  }
}
