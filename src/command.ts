#!/usr/bin/env node

import { Command } from 'commander'
import Watch from 'node-watch'

import { Dependency } from './dependency.js'
import { execLighthouse } from './lighthouse.js'
import { execLoadshow } from './loadshow.js'
import { Throttle } from './throttling.js'
import { FormFactorType } from './types.js'

import { InventoryRepository, ProxyOptions, withPlaybackProxy, withRecordingProxy } from './index.js'

const main = new Command()
const dependency = new Dependency()
const defaultInventoryRepository = new InventoryRepository('./inventory', dependency)

function lighthouseCommands() {
  const lighthouse = main.command('lighthouse')
  lighthouse.description('Run Lighthouse (performance category) via a proxy')
  lighthouse.option('-f, --form-factor <mobile|desktop>', 'Lighthouse form factor', 'mobile')

  const recording = lighthouse.command('recording')
  recording.description('Record contents by lighthouse')
  recording.argument('<url>', 'Url to measure performance')
  recording.action(async (url: string) => {
    await withRecordingProxy(
      {
        entryUrl: url,
        inventoryRepository: defaultInventoryRepository,
      },
      dependency,
      async (proxy) => {
        const formFactor: FormFactorType = lighthouse.opts().formFactor
        await execLighthouse({ url, proxyPort: proxy.port, formFactor, noThrottling: true, view: false }, dependency)
        dependency.logger?.info('Lighthouse completed. Saving inventory...')
      }
    )
  })

  const playback = lighthouse.command('playback')
  playback.description('Playback contents for lighthouse')
  playback.option('-c, --cpu-multiplier <number>', 'Lighthouse CPU multiplier', '4')
  playback.action(async () => {
    const cpuMultiplier: string = playback.opts().cpuMultiplier
    const formFactor: FormFactorType = lighthouse.opts().formFactor
    await withPlaybackProxy(
      {
        inventoryRepository: defaultInventoryRepository,
      },
      dependency,
      async (proxy) => {
        const url = proxy.entryUrl
        await execLighthouse({ url, proxyPort: proxy.port, formFactor, cpuMultiplier, view: true }, dependency)
        dependency.logger?.info('Lighthouse completed')
      }
    )
  })
}

function loadshowCommands() {
  const loadshow = main.command('loadshow')
  loadshow.description('Run loadshow via a proxy')
  loadshow.option('-f, --form-factor <mobile|desktop>', 'Lighthouse form factor', 'mobile')

  const recording = loadshow.command('recording')
  recording.description('Record contents by loadshow')
  recording.argument('<url>', 'Url to measure performance')
  recording.action(async (url: string) => {
    const formFactor: FormFactorType = recording.opts().formFactor
    await withRecordingProxy(
      { entryUrl: url, inventoryRepository: defaultInventoryRepository },
      dependency,
      async (proxy) => {
        await execLoadshow({ url, proxyPort: proxy.port, formFactor }, dependency)
        dependency.logger?.info('Loadshow completed. Saving inventory...')
      }
    )
  })

  const playback = loadshow.command('playback')
  playback.description('Playback contents for loadshow')
  playback.option('-l, --lighthouse', 'Run with lighthouse throttling')
  playback.action(async () => {
    const lighthouse: boolean = playback.opts().lighthouse
    const formFactor: FormFactorType = loadshow.opts().formFactor
    await withPlaybackProxy(
      {
        inventoryRepository: defaultInventoryRepository,
      },
      dependency,
      async (proxy) => {
        const url = proxy.entryUrl
        await execLoadshow({ url, proxyPort: proxy.port, formFactor, syncLighthouseSpec: lighthouse }, dependency)
        dependency.logger?.info('Loadshow completed')
      }
    )
  })
}

function proxyCommands() {
  const proxy = main.command('proxy')
  proxy.option('-p, --port <number>', 'Proxy port', '8080')
  proxy.option('-t, --throughput <number>', 'Throttle network throughput (Mbps)')

  proxy.action(async () => {
    const proxyOptions: ProxyOptions = {}

    if (proxy.opts().port) {
      proxyOptions.port = Number(proxy.opts().port)
    }

    if (proxy.opts().throughput) {
      proxyOptions.throttle = Throttle.fromMbps(Number(proxy.opts().throughput))
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await withPlaybackProxy(proxyOptions, dependency, async (proxy) => {
        const watcher = Watch(proxy.inventoryDirPath, { recursive: true })
        return new Promise((ok) => {
          watcher.on('change', () => {
            watcher.close()
            dependency.logger?.info('Inventory changed. Restarting proxy...')
            ok()
          })
        })
      })
    }
  })
}

lighthouseCommands()
loadshowCommands()
proxyCommands()

main.parse(process.argv)
