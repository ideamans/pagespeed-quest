#!/usr/bin/env node

import Fsp from 'fs/promises'

import { Command } from 'commander'
import Execa from 'execa'
import Watch from 'node-watch'

import { logger, withPlaybackProxy, WithProxyOptions, withRecordingProxy } from './index.js'

type FormFactorType = 'mobile' | 'desktop'

interface LighthouseOptions {
  url: string
  proxyPort: number
  cpuMultiplier?: string
  formFactor?: FormFactorType
  noThrottling?: boolean
  view?: boolean
}

async function runLighthouse(opts: LighthouseOptions) {
  await Fsp.mkdir('./artifacts', { recursive: true })

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

  await Execa('./node_modules/.bin/lighthouse', args)
}

const main = new Command()

function lighthouseCommands() {
  const lighthouse = main.command('lighthouse')
  lighthouse.description('Run Lighthouse (performance category) via a proxy')
  lighthouse.option('-f, --form-factor <mobile|desktop>', 'Lighthouse form factor', 'mobile')

  const recording = lighthouse.command('recording')
  recording.description('Record contents by lighthouse')
  recording.argument('<url>', 'Url to measure performance')
  recording.action(async (url: string) => {
    await withRecordingProxy(
      async (proxy) => {
        const formFactor: FormFactorType = lighthouse.opts().formFactor
        await runLighthouse({ url, proxyPort: proxy.port, formFactor, noThrottling: true, view: false })
        logger().info('Lighthouse completed. Saving inventory...')
      },
      {
        entryUrl: url,
      }
    )
  })

  const playback = lighthouse.command('playback')
  playback.description('Playback contents for lighthouse')
  playback.option('-c, --cpu-multiplier <number>', 'Lighthouse CPU multiplier', '4')
  playback.action(async () => {
    const cpuMultiplier: string = playback.opts().cpuMultiplier
    await withPlaybackProxy(
      async (proxy) => {
        const url = proxy.entryUrl
        await runLighthouse({ url, proxyPort: proxy.port, cpuMultiplier, view: true })
        logger().info('Lighthouse completed')
      },
      {
        throttling: {
          mbps: 1.6,
        },
      }
    )
  })
}

function proxyCommands() {
  const proxy = main.command('proxy')
  proxy.option('-d, --inventory-dir <path>', 'Inventory directory')
  proxy.option('-p, --port <number>', 'Proxy port', '8080')
  proxy.option('-t, --throughput <number>', 'Throttle network throughput (Mbps)')

  proxy.action(async () => {
    const proxyOptions: WithProxyOptions = {}

    if (proxy.opts().inventoryDir) {
      proxyOptions.dirPath = proxy.opts().inventoryDir
    }

    if (proxy.opts().port) {
      proxyOptions.port = Number(proxy.opts().port)
    }

    if (proxy.opts().throughput) {
      proxyOptions.throttling = {
        mbps: Number(proxy.opts().throughput),
      }
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await withPlaybackProxy(async (proxy) => {
        const watcher = Watch(proxy.inventoryDirPath, { recursive: true })
        return new Promise((ok) => {
          watcher.on('change', () => {
            watcher.close()
            logger().info('Inventory changed. Restarting proxy...')
            ok()
          })
        })
      }, proxyOptions)
    }
  })
}

lighthouseCommands()
proxyCommands()

main.parse(process.argv)
