import Fsp from 'fs/promises'
import Path from 'path'

import test from 'ava'
import Axios from 'axios'
import Tmp from 'tmp-promise'

import { InventoryRepository } from './inventory.js'
import { withPlaybackProxy } from './playback.js'

test('PlaybackProxy', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const inventoryDir = Path.join(tmp.path, 'inventory')
      await Fsp.mkdir(inventoryDir, { recursive: true })

      // Test inventory - Rust proxy expects inventory.json not index.json
      const inventoryRepository = new InventoryRepository(inventoryDir)
      const entryUrl = 'http://localhost:8099/'
      const resources = await inventoryRepository.saveTransactions([
        {
          method: 'GET',
          url: entryUrl,
          ttfbMs: 0,
          statusCode: 200,
          rawHeaders: {
            'content-type': 'text/plain',
          },
          content: Buffer.from('ok'),
        },
      ])
      await inventoryRepository.saveInventory({ resources, entryUrl })

      // Playback proxy
      await withPlaybackProxy(
        {
          inventoryRepository,
        },
        {},
        async (proxy) => {
          const response = await Axios.get(entryUrl, {
            proxy: {
              host: 'localhost',
              port: proxy.port,
            },
          })

          t.is(response.status, 200)
          t.is(response.data, 'ok')
        }
      )
    },
    { unsafeCleanup: true }
  )
})
