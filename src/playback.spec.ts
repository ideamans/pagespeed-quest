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
      const sslCaDir = Path.join(tmp.path, 'ca')
      await Fsp.mkdir(sslCaDir, { recursive: true })
      const inventoryDir = Path.join(tmp.path, 'inventory')
      await Fsp.mkdir(inventoryDir, { recursive: true })

      // Test inventory
      const inventoryRepository = new InventoryRepository(inventoryDir)
      const resources = await inventoryRepository.saveTransactions([
        {
          method: 'get',
          url: 'http://localhost/',
          ttfbMs: 0,
          statusCode: 200,
          rawHeaders: {
            'content-type': 'text/plain',
          },
          content: Buffer.from('ok'),
        },
      ])
      await inventoryRepository.saveInventory({ resources })

      // Playback proxy
      await withPlaybackProxy(
        async (proxy) => {
          const response = await Axios.get(`http://localhost/`, {
            proxy: {
              host: 'localhost',
              port: proxy.port,
            },
          })

          t.is(response.status, 200)
          t.is(response.data, 'ok')
        },
        { dirPath: inventoryDir }
      )
    },
    { unsafeCleanup: true }
  )
})
