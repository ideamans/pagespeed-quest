import { DependencyInterface } from './types.js'

export interface ExecWebshotCaptureInput {
  url: string
  proxyPort: number
  preset?: 'desktop' | 'mobile'
  output: string
  timeout: number
}

export interface ExecWebshotCompareInput {
  baseline: string
  current: string
  output: string
  digestTxt: string
  baselineLabel?: string
  currentLabel?: string
}

export async function execWebshotCapture(
  input: ExecWebshotCaptureInput,
  dependency: Pick<DependencyInterface, 'executeWebshot'>
): Promise<void> {
  const args: string[] = []
  args.push('capture')
  args.push('--proxy', `http://localhost:${input.proxyPort}`)
  args.push('--ignore-tls-errors')
  args.push('--preset', input.preset || 'mobile')
  args.push('--timeout', String(Math.ceil(input.timeout / 1000)))
  args.push('-o', input.output)
  args.push(input.url)

  await dependency.executeWebshot(args)
}

export async function execWebshotCompare(
  input: ExecWebshotCompareInput,
  dependency: Pick<DependencyInterface, 'executeWebshot'>
): Promise<void> {
  const args: string[] = []
  args.push('compare')
  args.push('-o', input.output)
  args.push('--digest-txt', input.digestTxt)
  if (input.baselineLabel) args.push('--baseline-label', input.baselineLabel)
  if (input.currentLabel) args.push('--current-label', input.currentLabel)
  args.push(input.baseline)
  args.push(input.current)

  await dependency.executeWebshot(args)
}
