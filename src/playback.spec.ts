import Fsp from 'fs/promises'
import Http from 'http'
import Path from 'path'

import test from 'ava'
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
          // Use Node.js HTTP module directly with proxy
          const response = await new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Request timeout')), 5000)

            const req = Http.request(
              {
                host: 'localhost',
                port: proxy.port,
                path: entryUrl,
                method: 'GET',
                headers: {
                  Host: 'localhost:8099',
                },
              },
              (res) => {
                clearTimeout(timeout)
                let data = ''
                res.on('data', (chunk) => {
                  data += chunk
                })
                res.on('end', () => {
                  resolve({
                    statusCode: res.statusCode || 0,
                    data,
                  })
                })
              }
            )

            req.on('error', (err) => {
              clearTimeout(timeout)
              reject(err)
            })

            req.end()
          })

          t.is(response.statusCode, 200)
          t.is(response.data, 'ok')
        }
      )
    },
    { unsafeCleanup: true }
  )
})
