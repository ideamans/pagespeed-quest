import Http from 'http'
import Path from 'path'

import test from 'ava'
import Axios from 'axios'
import GetPort from 'get-port'
import Tmp from 'tmp-promise'

import { Proxy } from './proxy.js'

class TestProxy extends Proxy {
  shutdownFlag = false

  async setup(): Promise<void> {
    this.proxy.onRequest((ctx, callback) => {
      ctx.onResponse((ctx, callback) => {
        ctx.proxyToClientResponse.setHeader('x-testing', '1')
        callback()
      })
      callback()
    })
  }

  async shutdown() {
    this.shutdownFlag = true
  }
}

test('Proxy', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const proxy = new TestProxy({
        sslCaDir: Path.join(tmp.path, 'ca'),
      })
      await proxy.start()

      const serverPort = await GetPort()
      const server = Http.createServer((_, res) => {
        res.setHeader('Content-Type', 'text/plain')
        res.end('ok')
      })
      await new Promise<void>((ok) => server.listen(serverPort, ok))

      const response = await Axios.get(`http://localhost:${serverPort}`, {
        proxy: {
          host: 'localhost',
          port: proxy.port,
        },
      })

      t.is(response.status, 200)
      t.is(response.data, 'ok')
      t.is(response.headers['x-testing'], '1')

      server.close()
      await proxy.stop()

      t.true
    },
    { unsafeCleanup: true }
  )
})
