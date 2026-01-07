import Path from 'path'

import { DependencyInterface, DeviceType } from './types.js'

export interface ExecLoadshowInput {
  url: string
  proxyPort: number
  deviceType?: DeviceType
  artifactsDir?: string
  timeout: number
  credit?: string
}

export interface ExecLoadshowSpec {
  preset?: 'desktop' | 'mobile'
  viewportWidth?: number
  columns?: number
  cpuThrottling?: number
  timeoutSec?: number
  proxyPort?: number
  credit?: string
  debugDir?: string
  outputSummary?: string
}

function execSpecToCommandArgs(spec: ExecLoadshowSpec): string[] {
  const args: string[] = []

  // preset
  if (spec.preset !== undefined) args.push('--preset', spec.preset)

  // layout
  if (spec.columns !== undefined) args.push('--columns', String(spec.columns))

  // browser settings
  if (spec.viewportWidth !== undefined) args.push('--viewport-width', String(spec.viewportWidth))
  if (spec.cpuThrottling !== undefined) args.push('--cpu-throttling', String(spec.cpuThrottling))

  // timeout
  if (spec.timeoutSec !== undefined) args.push('--timeout-sec', String(spec.timeoutSec))

  // proxy settings
  if (spec.proxyPort !== undefined) {
    args.push('--proxy-server', `http://localhost:${spec.proxyPort}`)
    args.push('--ignore-https-errors')
  }

  // credit
  if (spec.credit) args.push('--credit', spec.credit)

  // debug directory
  if (spec.debugDir) args.push('--debug-dir', spec.debugDir)

  // output summary
  if (spec.outputSummary) args.push('--output-summary', spec.outputSummary)

  return args
}

export async function execLoadshow(
  input: ExecLoadshowInput,
  dependency: Pick<DependencyInterface, 'mkdirp' | 'executeLoadshow'>
): Promise<void> {
  const artifactsDir = input.artifactsDir || './artifacts'
  const loadshowDir = Path.join(artifactsDir, 'loadshow')
  const outputPath = Path.join(artifactsDir, 'loadshow.mp4')
  const summaryPath = Path.join(loadshowDir, 'summary.md')
  await dependency.mkdirp(loadshowDir)

  // By form factor
  const preset: 'desktop' | 'mobile' = input.deviceType === 'desktop' ? 'desktop' : 'mobile'
  const customByDevice = input.deviceType === 'desktop' ? { columns: 2 } : { columns: 3 }

  // Convert timeout from milliseconds to seconds
  const timeoutSec = Math.ceil(input.timeout / 1000)

  // Basic spec
  const spec: ExecLoadshowSpec = {
    preset,
    proxyPort: input.proxyPort,
    columns: customByDevice.columns,
    timeoutSec,
    credit: input.credit,
    debugDir: loadshowDir,
    outputSummary: summaryPath,
  }

  const args: string[] = []
  args.push('record')
  args.push(...execSpecToCommandArgs(spec))
  args.push('--output', outputPath)
  args.push(input.url)

  await dependency.executeLoadshow(args)
}
