import { Proxy as RustProxy, startRecording } from 'rust-http-playback-proxy'

import { InventoryRepository } from './inventory.js'
import { DependencyInterface, DeviceType } from './types.js'

export interface RecordingProxyOptions {
  inventoryRepository?: InventoryRepository
  entryUrl?: string
  deviceType?: DeviceType
  port?: number
}

export type RecordingProxyDependency = Pick<DependencyInterface, 'logger'>

export class RecordingProxy {
  rustProxy?: RustProxy
  inventoryRepository!: InventoryRepository
  entryUrl?: string
  deviceType?: DeviceType
  requestedPort?: number
  dependency: RecordingProxyDependency

  constructor(options?: RecordingProxyOptions, dependency?: RecordingProxyDependency) {
    options ||= {}
    this.dependency = dependency || {}

    // Inventory repository
    this.inventoryRepository = options.inventoryRepository ?? new InventoryRepository(undefined, this.dependency)

    // Entry URL
    this.entryUrl = options.entryUrl

    // Device type
    this.deviceType = options.deviceType

    // Port
    this.requestedPort = options.port
  }

  async start() {
    this.dependency.logger?.info(`Starting recording proxy...`)

    const proxyPort = this.requestedPort || 0

    this.rustProxy = await startRecording({
      entryUrl: this.entryUrl,
      deviceType: this.deviceType,
      inventoryDir: this.inventoryRepository.dirPath,
      port: proxyPort,
    })

    this.dependency.logger?.info(`Recording proxy started on port ${this.rustProxy.port}`)
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
      this.dependency.logger?.info(`Stopping recording proxy...`)

      // Stop the proxy (this triggers graceful shutdown via SIGTERM signal)
      // The Rust proxy will save index.json automatically during graceful shutdown
      await this.rustProxy.stop()

      // Wait for the Rust proxy to finish writing files to disk
      // The Rust proxy needs time to process resources and save index.json
      await new Promise((resolve) => setTimeout(resolve, 2000))

      this.dependency.logger?.info(`Recording proxy stopped`)
    }
  }
}

export async function withRecordingProxy(
  options: RecordingProxyOptions,
  dependency: RecordingProxyDependency,
  cb: (proxy: RecordingProxy) => Promise<void>
): Promise<void> {
  const proxy = new RecordingProxy(options, dependency)
  await proxy.start()
  try {
    await cb(proxy)
  } finally {
    await proxy.stop()
  }
}
