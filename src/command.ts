#!/usr/bin/env node

import { Command } from 'commander'
import Watch from 'node-watch'

import { Dependency } from './dependency.js'
import { execLighthouse } from './lighthouse.js'
import { execLoadshow } from './loadshow.js'
import { DeviceType } from './types.js'

import { InventoryRepository, ProxyOptions, withPlaybackProxy, withRecordingProxy } from './index.js'

const dependency = new Dependency()

const main = new Command()
main.option('-i, --inventory <dir>', 'Inventory directory', './inventory')

function registerLighthouseCommands(main: Command) {
  const lighthouse = main.command('lighthouse')
  lighthouse.description('Run Lighthouse (performance category) via a proxy')
  lighthouse.option('-a, --artifacts <dir>', 'Artifacts directory', './artifacts')
  lighthouse.option('-q, --quiet', 'Run headless', false)
  lighthouse.option('-t, --timeout <ms>', 'Timeout milliseconds', '30000')

  const recording = lighthouse.command('recording')
  recording.description('Record contents by lighthouse')
  recording.option('-d, --device <mobile|desktop>', 'Device type', 'mobile')
  recording.argument('<url>', 'Url to measure performance')
  recording.action(async (url: string) => {
    const inventoryRepository = new InventoryRepository(main.opts().inventory || './inventory')
    const deviceType: DeviceType = recording.opts().device || 'mobile'
    const artifactsDir = lighthouse.opts().artifacts || './artifacts'
    const quiet = !!lighthouse.opts().quiet
    const timeout = Number(lighthouse.opts().timeout || '30000')

    await withRecordingProxy(
      {
        entryUrl: url,
        deviceType,
        inventoryRepository,
      },
      dependency,
      async (proxy) => {
        await execLighthouse(
          {
            url,
            proxyPort: proxy.port,
            deviceType,
            noThrottling: true,
            view: false,
            artifactsDir,
            headless: quiet,
            timeout,
          },
          dependency
        )
        dependency.logger?.info('Lighthouse completed. Saving inventory...')
      }
    )
  })

  const playback = lighthouse.command('playback')
  playback.description('Playback contents for lighthouse')
  playback.action(async () => {
    const inventoryRepository = new InventoryRepository(main.opts().inventory || './inventory')
    const artifactsDir = lighthouse.opts().artifacts || './artifacts'
    const quiet = !!lighthouse.opts().quiet
    const timeout = Number(lighthouse.opts().timeout || '30000')

    await withPlaybackProxy(
      {
        inventoryRepository,
      },
      dependency,
      async (proxy) => {
        await execLighthouse(
          {
            url: proxy.entryUrl,
            proxyPort: proxy.port,
            deviceType: proxy.deviceType,
            view: !quiet,
            artifactsDir,
            headless: quiet,
            timeout,
          },
          dependency
        )
        dependency.logger?.info('Lighthouse completed')
      }
    )
  })
}

function registerLoadshowCommands(main: Command) {
  const loadshow = main.command('loadshow')
  loadshow.description('Run loadshow via a proxy')
  loadshow.option('-a, --artifacts <dir>', 'Artifacts directory', './artifacts')
  loadshow.option('-t, --timeout <ms>', 'Timeout milliseconds', '30000')

  const recording = loadshow.command('recording')
  recording.description('Record contents by loadshow')
  recording.option('-d, --device <mobile|desktop>', 'Device type', 'mobile')
  recording.argument('<url>', 'Url to measure performance')
  recording.action(async (url: string) => {
    const inventoryRepository = new InventoryRepository(main.opts().inventory || './inventory')
    const deviceType: DeviceType = recording.opts().device || 'mobile'
    const artifactsDir = loadshow.opts().artifacts || './artifacts'
    const timeout = Number(loadshow.opts().timeout || '30000')

    await withRecordingProxy({ entryUrl: url, deviceType, inventoryRepository }, dependency, async (proxy) => {
      await execLoadshow({ url, proxyPort: proxy.port, deviceType, artifactsDir, timeout }, dependency)
      dependency.logger?.info('Loadshow completed. Saving inventory...')
    })
  })

  const playback = loadshow.command('playback')
  playback.description('Playback contents for loadshow')
  playback.option('-l, --lighthouse', 'Loadshow with lighthouse throttling')
  playback.action(async () => {
    const inventoryRepository = new InventoryRepository(main.opts().inventory || './inventory')
    const lighthouse: boolean = playback.opts().lighthouse
    const artifactsDir = loadshow.opts().artifacts || './artifacts'
    const timeout = Number(loadshow.opts().timeout || '30000')

    await withPlaybackProxy(
      {
        inventoryRepository,
      },
      dependency,
      async (proxy) => {
        await execLoadshow(
          {
            url: proxy.entryUrl,
            proxyPort: proxy.port,
            deviceType: proxy.deviceType,
            syncLighthouseSpec: lighthouse,
            artifactsDir,
            timeout,
          },
          dependency
        )
        dependency.logger?.info('Loadshow completed')
      }
    )
  })
}

function registerProxyCommands(main: Command) {
  const proxy = main.command('proxy')
  proxy.option('-p, --port <number>', 'Proxy port', '8080')

  proxy.action(async () => {
    const inventoryRepository = new InventoryRepository(main.opts().inventory || './inventory')
    const proxyOptions: ProxyOptions = {
      inventoryRepository,
      port: Number(proxy.opts().port || '8080'),
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      await withPlaybackProxy(proxyOptions, dependency, async () => {
        const watcher = Watch(inventoryRepository.dirPath, { recursive: true })
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

registerLighthouseCommands(main)
registerLoadshowCommands(main)
registerProxyCommands(main)

main.parse(process.argv)
