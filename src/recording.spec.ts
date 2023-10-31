import Fsp from 'fs/promises'
import Http from 'http'
import Path from 'path'

import test from 'ava'
import Axios from 'axios'
import GetPort from 'get-port'
import Tmp from 'tmp-promise'

import { InventoryRepository } from './inventory'
import { withRecordingProxy } from './recording'

test('RecordingProxy', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const sslCaDir = Path.join(tmp.path, 'ca')
      await Fsp.mkdir(sslCaDir, { recursive: true })
      const inventoryDir = Path.join(tmp.path, 'inventory')
      await Fsp.mkdir(inventoryDir, { recursive: true })

      // Dummy server
      const serverPort = await GetPort()
      const server = Http.createServer((_, res) => {
        res.setHeader('Content-Type', 'text/plain')
        res.end('ok')
      })
      await new Promise<void>((ok) => server.listen(serverPort, ok))

      // Recording proxy
      const inventoryRepository = new InventoryRepository(inventoryDir)
      await withRecordingProxy(
        async (proxy) => {
          const response = await Axios.get(`http://localhost:${serverPort}`, {
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

      const inventory = await inventoryRepository.loadInventory()
      t.is(inventory.resources.length, 1)
    },
    { unsafeCleanup: true }
  )
})
