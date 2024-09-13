import { IncomingHttpHeaders } from 'http'

import { Inventory, Transaction } from './inventory.js'
import { Proxy, ProxyDependency, ProxyOptions } from './proxy.js'

export interface RecordingTransaction {
  startedAt?: Date
  responseStartedAt?: Date
  responseEndedAt?: Date
  method: string
  url: string
  statusCode?: number
  incomingHttpHeaders?: IncomingHttpHeaders
  contentChunks: Buffer[]
  err?: Error
  errKind?: string
}

export interface RecordingSession {
  startedAt?: Date
  transactions: RecordingTransaction[]
}

export class RecordingProxy extends Proxy {
  startedAt?: Date
  transactions: RecordingTransaction[] = []

  async setup(): Promise<void> {
    this.startedAt = new Date()

    let requestNumber = 1
    this.proxy.onRequest((ctx, onRequestComplete) => {
      const number = requestNumber++

      // Throttling
      const filter = this.createThrottlingTransform()
      if (filter) ctx.addResponseFilter(filter)

      const identifier = Proxy.contextRequest(ctx)
      const transaction: RecordingTransaction = {
        startedAt: new Date(),
        ...identifier,
        contentChunks: [],
      }

      this.dependency.logger?.debug({ number, identifier }, `Request #${number} ${transaction.url} started`)

      ctx.onError((_, err, errKind) => {
        transaction.responseStartedAt = new Date()
        transaction.err = err
        transaction.errKind = errKind
        this.dependency.logger?.warn(
          { number, identifier, err },
          `Request #${number} ${transaction.url} failed: ${err.message}`
        )
      })

      ctx.onResponse((_, onResponseComplete) => {
        transaction.responseStartedAt = new Date()
        transaction.statusCode = ctx.serverToProxyResponse.statusCode
        transaction.incomingHttpHeaders = ctx.serverToProxyResponse.headers
        this.dependency.logger?.debug({ number, identifier }, `Request #${number} ${transaction.url} responded`)
        onResponseComplete()
      })

      ctx.onResponseData((_, chunk, onResponseDataComplete) => {
        transaction.contentChunks.push(chunk)
        onResponseDataComplete(null, chunk)
      })

      ctx.onResponseEnd((_, onResponseEndComplete) => {
        transaction.responseEndedAt = new Date()
        this.transactions.push(transaction)
        this.dependency.logger?.debug({ number, identifier }, `Request #${number} ${transaction.url} completed`)
        onResponseEndComplete()
      })

      onRequestComplete()
    })
  }

  async saveInventory() {
    const transactions: Transaction[] = []

    for (const requestTransaction of this.transactions) {
      const transaction: Transaction = {
        method: requestTransaction.method,
        url: requestTransaction.url,
        ttfbMs: 0,
        content: Buffer.concat(requestTransaction.contentChunks),
      }

      // ttfb and duration
      if (requestTransaction.responseStartedAt) {
        transaction.ttfbMs = +requestTransaction.responseStartedAt - +requestTransaction.startedAt

        if (requestTransaction.responseEndedAt) {
          transaction.durationMs = +requestTransaction.responseEndedAt - +requestTransaction.responseStartedAt
        }
      }

      // error
      if (requestTransaction.err) {
        transaction.errorMessage = requestTransaction.err.message
      }

      // status code
      if (requestTransaction.statusCode) {
        transaction.statusCode = requestTransaction.statusCode
      }

      // headers
      if (requestTransaction.incomingHttpHeaders) {
        transaction.rawHeaders = {}
        for (const [key, value] of Object.entries(requestTransaction.incomingHttpHeaders)) {
          transaction.rawHeaders[key.toLowerCase()] = value.toString()
        }
      }

      transactions.push(transaction)
    }

    const resources = await this.inventoryRepository.saveTransactions(transactions)
    const inventory: Inventory = { entryUrl: this.entryUrl, resources }
    await this.inventoryRepository.saveInventory(inventory)
  }

  async shutdown(): Promise<void> {
    await this.saveInventory()
  }
}

export async function withRecordingProxy(
  options: ProxyOptions,
  dependency: ProxyDependency,
  cb: (proxy: RecordingProxy) => Promise<void>
): Promise<void> {
  const proxy = new RecordingProxy(options, dependency)
  await proxy.start()
  await cb(proxy)
  await proxy.stop()
}
