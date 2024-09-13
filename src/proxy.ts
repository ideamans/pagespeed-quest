import Crypto from 'crypto'
import Fsp from 'fs/promises'
import Http from 'http'
import Https from 'https'
import Os from 'os'
import Path from 'path'

import GetPort from 'get-port'
import HttpMitmProxy from 'http-mitm-proxy'

import { InventoryRepository } from './inventory.js'
import { Throttle, ThrottlingTransform } from './throttling.js'
import { DependencyInterface } from './types.js'

export interface ProxyOptions extends HttpMitmProxy.IProxyOptions {
  inventoryRepository?: InventoryRepository
  throttle?: Throttle
  throttlingRetryIntervalMs?: number
  entryUrl?: string
}

export type ProxyDependency = Pick<DependencyInterface, 'logger'>

export abstract class Proxy {
  proxyOptions!: HttpMitmProxy.IProxyOptions
  proxy!: HttpMitmProxy.IProxy
  inventoryRepository!: InventoryRepository
  throttle?: Throttle
  throttlingRetryIntervalMs!: number
  entryUrl?: string
  dependency: ProxyDependency

  constructor(options?: ProxyOptions, dependency?: ProxyDependency) {
    options ||= {}
    this.dependency = dependency || {}

    // Proxy
    this.proxyOptions = options
    this.proxy = HttpMitmProxy()

    // Inventory repository
    this.inventoryRepository = options.inventoryRepository ?? new InventoryRepository(undefined, this.dependency)

    // Throttle
    if (options.throttle) this.throttle = options.throttle
    this.throttlingRetryIntervalMs = options.throttlingRetryIntervalMs || 10

    // Entry URL
    this.entryUrl = options.entryUrl
  }

  static contextRequest(ctx: HttpMitmProxy.IContext): { method: string; url: string } {
    if (!ctx.clientToProxyRequest.headers.host) throw new Error('ctx.clientToProxyRequest.headers.host is empty')

    const url = [
      ctx.isSSL ? 'https://' : 'http://',
      ctx.clientToProxyRequest.headers.host,
      ctx.clientToProxyRequest.url,
    ].join('')

    const method = (ctx.clientToProxyRequest.method || 'get').toLowerCase()

    return {
      method,
      url,
    }
  }

  createThrottlingTransform(): ThrottlingTransform | void {
    if (this.throttle) {
      return new ThrottlingTransform(this.throttle, this.throttlingRetryIntervalMs)
    }
  }

  abstract setup(): Promise<void>
  abstract shutdown(): Promise<void>

  async start() {
    if (this.throttle) this.throttle.start()

    const sslCaDir =
      this.proxyOptions.sslCaDir || process.env.SSL_CA_DIR || Path.join(Os.homedir(), '.pagespeed-quest/ca')
    const port = Number(this.proxyOptions.port || process.env.PORT || (await GetPort()))

    const options: HttpMitmProxy.IProxyOptions = {
      port,
      sslCaDir,
      httpAgent: new Http.Agent({
        keepAlive: true,
      }),
      httpsAgent: new Https.Agent({
        keepAlive: true,
        secureOptions: Crypto.constants.SSL_OP_LEGACY_SERVER_CONNECT,
      }),
    }
    await this.setup()

    await Fsp.mkdir(options.sslCaDir, { recursive: true })

    await new Promise<void>((resolve, reject) =>
      this.proxy.listen(options, (error) => (error ? reject(error) : resolve()))
    )

    this.dependency.logger?.info(`Proxy started to listening on port ${this.port}`)
  }

  get port(): number {
    return this.proxy.httpPort
  }

  get inventoryDirPath(): string {
    return this.inventoryRepository.dirPath
  }

  async stop() {
    this.proxy.close()
    await this.shutdown()
    if (this.throttle) this.throttle.stop()
    this.dependency.logger?.info(`Proxy stopped`)
  }
}

export async function withProxy<ProxyType extends Proxy>(
  proxy: ProxyType,
  fn: (proxy: ProxyType) => Promise<void>
): Promise<void> {
  await proxy.start()
  await fn(proxy)
  await proxy.stop()
}

// export interface WithProxyOptions extends HttpMitmProxy.IProxyOptions {
//   port?: number
//   dirPath?: string
//   entryUrl?: string
//   throttling?: { mbps: number; flushIntervalMs?: number; retryIntervalMs?: number }
// }

// export async function withProxy<ProxyType extends Proxy, OptionsType extends WithProxyOptions = WithProxyOptions>(
//   cls: new (options: ProxyOptions) => ProxyType,
//   fn: (proxy: ProxyType) => Promise<void>,
//   options: OptionsType
// ): Promise<ProxyType | void> {
//   const proxyOptions: ProxyOptions = {
//     ...options,
//     inventoryRepository: new InventoryRepository(options?.dirPath),
//   }

//   if (options.throttling) {
//     proxyOptions.throttle = Throttle.fromMbps(options.throttling.mbps, options.throttling.flushIntervalMs)
//     proxyOptions.throttlingRetryIntervalMs = options.throttling.retryIntervalMs
//   }

//   const proxy = new cls(proxyOptions)

//   // start
//   await proxy.start()

//   // callback
//   await fn(proxy)

//   // stop
//   await proxy.stop()

//   return proxy
// }
