import Fsp from 'fs/promises'

import { Dependency } from './dependency.js'
import { InventoryRepository } from './inventory.js'
import { execLighthouse } from './lighthouse.js'
import { withPlaybackProxy } from './playback.js'
import { withRecordingProxy } from './recording.js'

const dependency = new Dependency()

export async function recording() {
  const sampleUrl = 'https://www.gov-online.go.jp/'
  // const sampleUrl = 'https://blog.ideamans.com/'

  await Fsp.mkdir('./tmp', { recursive: true })
  const inventoryRepository = new InventoryRepository('./tmp', dependency)
  await withRecordingProxy(
    {
      inventoryRepository,
    },
    dependency,
    async (proxy) => {
      proxy.entryUrl = sampleUrl
      await execLighthouse({ url: sampleUrl, proxyPort: proxy.port }, dependency)
    }
  )
}

export async function playback() {
  const inventoryRepository = new InventoryRepository('./tmp', dependency)
  await withPlaybackProxy(
    {
      inventoryRepository,
    },
    dependency,
    async (proxy) => {
      if (!proxy.entryUrl) throw new Error('proxy.entryUrl is empty')
      await execLighthouse({ url: proxy.entryUrl, proxyPort: proxy.port }, dependency)
    }
  )
}

playback()
