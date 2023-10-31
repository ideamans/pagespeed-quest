import { HttpHeaders } from './http'
import { Inventory } from './inventory'
import { logger } from './logger'
import { Proxy, withProxy, WithProxyOptions } from './proxy'

const ChunkSize = 1024 * 16

export interface PlaybackTransaction {
  method: string
  url: string
  ttfbMs: number
  statusCode?: number
  err?: Error
  rawHeaders?: HttpHeaders
  contentChunks: Buffer[]
  contentLength: number
  durationMs: number
}

export class PlaybackProxy extends Proxy {
  transactionsMap: Map<string, Map<string, PlaybackTransaction>> = new Map()

  async loadTransactions(inventory: Inventory): Promise<void> {
    const transactions = await this.inventoryRepository.loadTransactions(inventory.resources)

    for (const transaction of transactions) {
      const playbackTransaction: PlaybackTransaction = {
        method: transaction.method,
        url: transaction.url,
        ttfbMs: transaction.ttfbMs,
        statusCode: transaction.statusCode,
        err: transaction.errorMessage ? new Error(transaction.errorMessage) : undefined,
        rawHeaders: transaction.rawHeaders || {},
        contentChunks: [],
        contentLength: 0,
        durationMs: transaction.durationMs || 0,
      }

      if (transaction.content) {
        const maxChunks = 10
        const minInterval = 10
        const chunks = Math.min(maxChunks, Math.floor(playbackTransaction.durationMs / minInterval))

        playbackTransaction.contentChunks = []
        const chunkSize = Math.max(ChunkSize, Math.ceil(transaction.content.length / chunks))
        for (let i = 0; i <= transaction.content.length; i += chunkSize) {
          playbackTransaction.contentChunks.push(transaction.content.subarray(i, i + chunkSize))
        }
      }

      if (!this.transactionsMap.has(transaction.method)) {
        this.transactionsMap.set(transaction.method, new Map())
      }
      this.transactionsMap.get(transaction.method).set(transaction.url, playbackTransaction)
    }
  }

  async setup(): Promise<void> {
    const inventory = await this.inventoryRepository.loadInventory()
    await this.loadTransactions(inventory)
    if (inventory.entryUrl) this.entryUrl = inventory.entryUrl

    let requestNumber = 1
    this.proxy.onRequest((ctx, onRequestComplete) => {
      const number = requestNumber++

      const identifier = Proxy.contextRequest(ctx)
      const transaction = this.transactionsMap.get(identifier.method)?.get(identifier.url)
      if (!transaction) {
        logger().warn(
          { number, identifier },
          `Request #${number} ${identifier.url} (${identifier.method}) not found in inventory`
        )
        return onRequestComplete()
      }

      const contentStream = this.createThrottlingTransform() || ctx.proxyToClientResponse

      if (contentStream !== ctx.proxyToClientResponse) {
        contentStream.pipe(ctx.proxyToClientResponse)
      }

      logger().debug({ number, identifier }, `Request #${number} ${transaction.url} started`)

      ctx.onError((_, err) => {
        logger().warn({ number, identifier, err }, `Request #${number} ${transaction.url} failed: ${err.message}`)
      })

      setTimeout(() => {
        // Error
        if (transaction.err) {
          return onRequestComplete(transaction.err)
        }

        // Status code
        ctx.proxyToClientResponse.statusCode = transaction.statusCode || 500

        // Headers
        if (transaction.rawHeaders) {
          for (const [key, value] of Object.entries(transaction.rawHeaders)) {
            if (ctx.proxyToClientResponse.headersSent) break
            ctx.proxyToClientResponse.setHeader(key, value)
          }
        }

        // Empty content body
        if (!transaction.contentChunks || transaction.contentChunks.length === 0) {
          contentStream.end()
          return
        }

        // Content body
        const chunks = [...transaction.contentChunks]
        const intervalMs = transaction.durationMs / transaction.contentChunks.length
        const interval = setInterval(() => {
          const chunk = chunks.shift()
          if (chunk) {
            contentStream.write(chunk)
          }
          if (chunks.length === 0) {
            clearInterval(interval)
            contentStream.end()
            logger().debug({ number, identifier }, `Request #${number} ${transaction.url} completed`)
          }
        }, intervalMs)
      }, transaction.ttfbMs)
    })
  }

  async shutdown(): Promise<void> {
    // nothing to do
  }
}

export async function withPlaybackProxy(fn: (proxy: PlaybackProxy) => Promise<void>, options?: WithProxyOptions) {
  return await withProxy<PlaybackProxy>(PlaybackProxy, fn, options || {})
}
