import { Proxy as RustProxy, startPlayback } from 'rust-http-playback-proxy'

import { Inventory, InventoryRepository } from './inventory.js'
import { DependencyInterface, DeviceType } from './types.js'

export interface PlaybackProxyOptions {
  inventoryRepository?: InventoryRepository
  port?: number
  fullThrottle?: boolean
}

export type PlaybackProxyDependency = Pick<DependencyInterface, 'logger'>

export class PlaybackProxy {
  rustProxy?: RustProxy
  inventoryRepository!: InventoryRepository
  entryUrl?: string
  deviceType?: DeviceType
  requestedPort?: number
  fullThrottle?: boolean
  dependency: PlaybackProxyDependency

  constructor(options?: PlaybackProxyOptions, dependency?: PlaybackProxyDependency) {
    options ||= {}
    this.dependency = dependency || {}

    // Inventory repository
    this.inventoryRepository = options.inventoryRepository ?? new InventoryRepository(undefined, this.dependency)

    // Port
    this.requestedPort = options.port

    // Full throttle
    this.fullThrottle = options.fullThrottle
  }

  async start() {
    this.dependency.logger?.info(`Starting playback proxy...`)

    // Load inventory to get entryUrl and deviceType
    const inventory: Inventory = await this.inventoryRepository.loadInventory()
    this.entryUrl = inventory.entryUrl
    this.deviceType = inventory.deviceType

    this.rustProxy = await startPlayback({
      inventoryDir: this.inventoryRepository.dirPath,
      port: this.requestedPort || 0,
      fullThrottle: this.fullThrottle,
    })

    this.dependency.logger?.info(`Playback proxy started on port ${this.rustProxy.port}`)
  }

  get port(): number {
    if (!this.rustProxy) throw new Error('Proxy not started')
    return this.rustProxy.port
  }

  get inventoryDirPath(): string {
    return this.inventoryRepository.dirPath
  }

  async stop() {
    if (this.rustProxy) {
      this.dependency.logger?.info(`Stopping playback proxy...`)
      await this.rustProxy.stop()
      this.dependency.logger?.info(`Playback proxy stopped`)
    }
  }
}

export async function withPlaybackProxy(
  options: PlaybackProxyOptions,
  dependency: PlaybackProxyDependency,
  cb: (proxy: PlaybackProxy) => Promise<void>
): Promise<void> {
  const proxy = new PlaybackProxy(options, dependency)
  await proxy.start()
  try {
    await cb(proxy)
  } finally {
    await proxy.stop()
  }
}
