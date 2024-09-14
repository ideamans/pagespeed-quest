import { defaultConfig, desktopConfig } from 'lighthouse'

import { DependencyInterface, DeviceType } from './types.js'

export interface ExecLoadshowInput {
  url: string
  proxyPort: number
  deviceType?: DeviceType
  noThrottling?: boolean
  syncLighthouseSpec?: boolean
}

export interface ExecLoadshowSpec {
  viewportWidth?: number
  columns?: number
  cpuThrottling?: number
  networkLatencyMs?: number
  networkThroughputMbps?: number
  userAgent?: string
  proxyPort?: number
}

function execSpecToCommandArgs(spec: ExecLoadshowSpec): string[] {
  const args: string[] = []

  // layout
  if (spec.columns !== undefined) args.push('-u', `layout.columns=${spec.columns}`)

  // recording
  if (spec.viewportWidth !== undefined) args.push('-u', `recording.viewportWidth=${spec.viewportWidth}`)
  if (spec.cpuThrottling !== undefined) args.push('-u', `recording.cpuThrottling=${spec.cpuThrottling}`)
  if (spec.networkLatencyMs !== undefined) args.push('-u', `recording.network.latencyMs=${spec.networkLatencyMs}`)
  if (spec.networkThroughputMbps !== undefined) {
    args.push('-u', `recording.network.uploadThroughputMbps=${spec.networkThroughputMbps}`)
    args.push('-u', `recording.network.downloadThroughputMbps=${spec.networkThroughputMbps}`)
  }
  if (spec.userAgent !== undefined) args.push('-u', `recording.headers.User-Agent=${spec.userAgent}`)

  // recording.puppeteer
  const chromeArgs: string[] = ['--ignore-certificate-errors']
  if (spec.proxyPort !== undefined) {
    chromeArgs.push(`--proxy-server=http://localhost:${spec.proxyPort}`)
  }
  args.push('-u', 'recording.puppeteer.args=' + chromeArgs.join(' '))

  return args
}

export async function execLoadshow(
  input: ExecLoadshowInput,
  dependency: Pick<DependencyInterface, 'mkdirp' | 'executeLoadshow'>
): Promise<void> {
  await dependency.mkdirp('./artifacts/loadshow')

  // By form factor
  const lighthouseByDevice = input.deviceType === 'desktop' ? desktopConfig : defaultConfig
  const customByDevice = input.deviceType === 'desktop' ? { columns: 2 } : { columns: 3 }

  // Basic spec
  const userAgent = lighthouseByDevice.settings?.emulatedUserAgent
  const spec: ExecLoadshowSpec = {
    proxyPort: input.proxyPort,
    columns: customByDevice.columns,
    viewportWidth: lighthouseByDevice.settings?.screenEmulation?.width,
    cpuThrottling: lighthouseByDevice.settings?.throttling?.cpuSlowdownMultiplier,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
  }

  // Sync network conditions with Lighthouse
  if (input.syncLighthouseSpec) {
    if (lighthouseByDevice.settings?.throttling?.rttMs)
      spec.networkLatencyMs = lighthouseByDevice.settings?.throttling?.rttMs
    if (lighthouseByDevice.settings?.throttling?.throughputKbps)
      spec.networkThroughputMbps = lighthouseByDevice.settings?.throttling?.throughputKbps / 1024
  }

  // No throttling
  if (input.noThrottling) {
    spec.networkLatencyMs = 0
    spec.networkThroughputMbps = 999999
  }

  const args: string[] = []
  args.push('record', '-a', './artifacts/loadshow')
  args.push(...execSpecToCommandArgs(spec))
  args.push(input.url, './artifacts/loadshow.mp4')

  await dependency.executeLoadshow(args)
}
