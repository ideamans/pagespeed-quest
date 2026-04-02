import { spawn } from 'child_process'
import { createRequire } from 'module'
import Net from 'net'
import Path from 'path'

import { Proxy as RustProxy, startRecording } from 'rust-http-playback-proxy'

import { InventoryRepository } from './inventory.js'
import { DependencyInterface, DeviceType } from './types.js'

export interface RecordingProxyOptions {
  inventoryRepository?: InventoryRepository
  entryUrl?: string
  deviceType?: DeviceType
  port?: number
  excludePatterns?: string[]
}

export type RecordingProxyDependency = Pick<DependencyInterface, 'logger'>

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = Net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address && typeof address === 'object') {
        const port = address.port
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('Failed to get port from server address')))
      }
    })
    server.on('error', reject)
  })
}

async function waitForPort(port: number, timeoutMs = 60000): Promise<void> {
  const startTime = Date.now()
  let delay = 50
  while (Date.now() - startTime < timeoutMs) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = Net.createConnection({ port, host: '127.0.0.1' })
        socket.on('connect', () => {
          socket.destroy()
          resolve()
        })
        socket.on('error', reject)
        socket.setTimeout(1000, () => {
          socket.destroy()
          reject(new Error('Connection timeout'))
        })
      })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, delay))
      delay = Math.min(delay * 1.5, 500)
    }
  }
  throw new Error(`Timeout waiting for port ${port} to become available`)
}

export class RecordingProxy {
  rustProxy?: RustProxy
  inventoryRepository!: InventoryRepository
  entryUrl?: string
  deviceType?: DeviceType
  requestedPort?: number
  excludePatterns?: string[]
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

    // Exclude patterns
    this.excludePatterns = options.excludePatterns
  }

  async start() {
    this.dependency.logger?.info(`Starting recording proxy...`)

    const proxyPort = this.requestedPort || 0

    if (this.excludePatterns && this.excludePatterns.length > 0) {
      // Use direct binary spawn to support -x exclude patterns
      this.rustProxy = await startRecordingWithExclude({
        entryUrl: this.entryUrl,
        deviceType: this.deviceType,
        inventoryDir: this.inventoryRepository.dirPath,
        port: proxyPort,
        excludePatterns: this.excludePatterns,
      })
    } else {
      this.rustProxy = await startRecording({
        entryUrl: this.entryUrl,
        deviceType: this.deviceType,
        inventoryDir: this.inventoryRepository.dirPath,
        port: proxyPort,
      })
    }

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

interface StartRecordingWithExcludeOptions {
  entryUrl?: string
  deviceType?: DeviceType
  inventoryDir?: string
  port?: number
  excludePatterns: string[]
}

function getProxyBinaryPath(): string {
  const require = createRequire(import.meta.url)
  // Resolve the main entry point (which is allowed by exports) and derive package root
  const mainPath = require.resolve('rust-http-playback-proxy')
  // mainPath is like .../node_modules/rust-http-playback-proxy/dist/index.js
  const pkgDir = Path.resolve(Path.dirname(mainPath), '..')
  const platform = process.platform === 'win32' ? 'windows' : process.platform
  const arch = process.arch
  const ext = process.platform === 'win32' ? '.exe' : ''
  return Path.join(pkgDir, 'bin', `${platform}-${arch}`, `http-playback-proxy${ext}`)
}

async function startRecordingWithExclude(options: StartRecordingWithExcludeOptions): Promise<RustProxy> {
  const binaryPath = getProxyBinaryPath()

  let port: number
  if (options.port === undefined || options.port === 0) {
    port = await getAvailablePort()
  } else {
    port = options.port
  }

  const deviceType = options.deviceType || 'mobile'
  const inventoryDir = options.inventoryDir || './inventory'

  const args = ['recording']

  if (options.entryUrl) {
    args.push(options.entryUrl)
  }

  args.push('--port', port.toString())
  args.push('--device', deviceType)
  args.push('--inventory', inventoryDir)

  for (const pattern of options.excludePatterns) {
    args.push('--exclude', pattern)
  }

  const proc = spawn(binaryPath, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    detached: false,
  })

  const proxy = new RustProxy('recording', port, inventoryDir, options.entryUrl, deviceType)
  proxy.setProcess(proc)

  let exited = false
  proc.on('exit', (code) => {
    exited = true
    if (code !== 0 && code !== null) {
      console.error(`Proxy process exited early with code ${code}`)
    }
  })

  try {
    await waitForPort(port, 15000)
  } catch (err) {
    if (exited) {
      throw new Error('Proxy process exited before port became available')
    }
    throw err
  }

  return proxy
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
