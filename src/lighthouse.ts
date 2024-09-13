import { DependencyInterface, FormFactorType } from './types.js'

export interface ExecLighthouseInput {
  url: string
  proxyPort: number
  formFactor?: FormFactorType
  cpuMultiplier?: string
  noThrottling?: boolean
  view?: boolean
}

export async function execLighthouse(
  opts: ExecLighthouseInput,
  dependency: Pick<DependencyInterface, 'mkdirp' | 'executeLighthouse'>
): Promise<void> {
  await dependency.mkdirp('./artifacts')

  const formFactor = opts.formFactor || 'mobile'
  const args: string[] = [
    opts.url,
    '--save-assets',
    '--output=html,json',
    '--output-path=./artifacts/lighthouse',
    '--only-categories=performance',
    `--form-factor=${formFactor}`,
  ]

  if (opts.noThrottling) {
    args.push(
      '--throttling.rttMs=0',
      '--throttling.throughputKbps=0',
      '--throttling.downloadThroughputKbps=0',
      '--throttling.uploadThroughputKbps=0',
      '--throttling.cpuSlowdownMultiplier=1'
    )
  } else if (opts.cpuMultiplier) args.push(`--throttling.cpuSlowdownMultiplier=${opts.cpuMultiplier}`)

  const chromeFlags: string[] = ['--ignore-certificate-errors', `--proxy-server=http://localhost:${opts.proxyPort}`]
  args.push(`--chrome-flags="${chromeFlags.join(' ')}"`)

  if (opts.view) args.push('--view')

  await dependency.executeLighthouse(args)
}
