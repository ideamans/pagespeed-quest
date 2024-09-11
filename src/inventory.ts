import Fs from 'fs'
import Fsp from 'fs/promises'
import Path from 'path'

import { compress, ContentEncodingType, decompress } from './encoding.js'
import { convertEditableText, isText } from './formatting.js'
import { HttpHeaders, parseContentTypeHeader, requestContentFilePath, stringifyContentTypeHeader } from './http.js'
import { logger } from './logger.js'

const InventoryDir = 'inventory'
const IndexFile = 'index.json'

export interface Resource {
  method: string
  url: string
  ttfbMs: number
  mbps?: number
  statusCode?: number
  errorMessage?: string
  rawHeaders?: HttpHeaders
  contentEncoding?: ContentEncodingType
  contentTypeMime?: string
  contentTypeCharset?: string
  contentFilePath?: string
  minify?: boolean
}

export interface Transaction {
  method: string
  url: string
  ttfbMs: number
  statusCode?: number
  errorMessage?: string
  rawHeaders?: HttpHeaders
  content?: Buffer
  durationMs?: number
}

export interface Inventory {
  entryUrl?: string
  resources: Resource[]
}

export class InventoryRepository {
  dirPath!: string

  constructor(dirPath?: string) {
    this.dirPath = dirPath || Path.join(process.cwd(), InventoryDir)
  }

  async saveInventory(inventory: Inventory) {
    const inventoryJson = JSON.stringify(inventory, null, 2)
    await Fsp.mkdir(this.dirPath, { recursive: true })
    await Fsp.writeFile(Path.join(this.dirPath, IndexFile), inventoryJson)
  }

  async loadInventory(): Promise<Inventory> {
    const inventoryJson = await Fsp.readFile(Path.join(this.dirPath, IndexFile), 'utf8')
    const inventory = JSON.parse(inventoryJson)
    return inventory
  }

  async saveTransactions(transactions: Transaction[]): Promise<Resource[]> {
    // To keep transactions order in Promise.all,
    // store transactions and resources in a map.
    const map = new Map<Transaction, Resource>()

    await Fsp.mkdir(this.dirPath, { recursive: true })

    const saveTransaction = async (transaction: Transaction) => {
      const resource: Resource = {
        method: transaction.method,
        url: transaction.url,
        ttfbMs: transaction.ttfbMs,
        statusCode: transaction.statusCode,
        errorMessage: transaction.errorMessage,
        rawHeaders: transaction.rawHeaders,
      }

      // Headers
      if (transaction.rawHeaders) {
        if (transaction.rawHeaders['content-type']) {
          const { mime, charset } = parseContentTypeHeader(transaction.rawHeaders['content-type'])
          if (mime) resource.contentTypeMime = mime
          if (charset) resource.contentTypeCharset = charset
        }

        if (transaction.rawHeaders['content-encoding']) {
          const contentEncoding = transaction.rawHeaders['content-encoding'] as ContentEncodingType
          if (contentEncoding) resource.contentEncoding = contentEncoding
        }
      }

      // Mbps
      if (transaction.durationMs && transaction.content) {
        const contentBits = transaction.content.length * 8
        const seconds = transaction.durationMs / 1000
        const mega = 1024 * 1024
        resource.mbps = contentBits / seconds / mega
      }

      // Content
      if (transaction.content) {
        const steps: {
          decoded?: Buffer
          editable?: Buffer
        } = {}

        const contentFilePath = requestContentFilePath(resource.method, resource.url)
        const fullPath = Path.join(this.dirPath, contentFilePath)

        // Content-Encoding
        steps.decoded = resource.contentEncoding
          ? await decompress(resource.contentEncoding, transaction.content)
          : transaction.content

        // Try to make editable (utf8, beautify)
        steps.editable = steps.decoded
        if (isText(resource.contentTypeMime)) {
          try {
            steps.editable = await convertEditableText(
              steps.decoded,
              resource.contentTypeMime,
              resource.contentTypeCharset
            )
            resource.contentTypeCharset = 'utf-8'
          } catch (err) {
            logger().error({ err, resource }, `Formatting failed ${transaction.url}: ${err.message}`)
          }
        }

        await Fsp.mkdir(Path.dirname(fullPath), { recursive: true })
        await Fsp.writeFile(fullPath, steps.editable)

        resource.contentFilePath = contentFilePath
      }

      map.set(transaction, resource)
    }

    const tryToSaveTransaction = async (transaction: Transaction) => {
      try {
        await saveTransaction(transaction)
      } catch (err) {
        logger().error(
          { err, method: transaction.method, url: transaction.url },
          `Failed to save transaction ${transaction.url}: ${err.message}`
        )
      }
    }

    await Promise.all(transactions.map(tryToSaveTransaction))

    // Restore transactions order after Promise.all
    const resources: Resource[] = transactions.reduce<Resource[]>((resources, transaction) => {
      const resource = map.get(transaction)
      if (resource) resources.push(resource)
      return resources
    }, [])

    return resources
  }

  async loadTransactions(resources: Resource[]): Promise<Transaction[]> {
    const map = new Map<Resource, Transaction>()

    const loadTransaction = async (resource: Resource) => {
      const transaction: Transaction = {
        method: resource.method,
        url: resource.url,
        ttfbMs: resource.ttfbMs,
        statusCode: resource.statusCode,
        errorMessage: resource.errorMessage,
        rawHeaders: { ...(resource.rawHeaders || {}) },
      }

      // content
      if (resource.contentFilePath) {
        const fullPath = Path.join(this.dirPath, resource.contentFilePath)
        if (Fs.existsSync(fullPath)) {
          const content = await Fsp.readFile(fullPath)

          // encoding
          if (resource.contentEncoding) {
            transaction.content = await compress(resource.contentEncoding, content)
            transaction.rawHeaders['content-encoding'] = resource.contentEncoding
          } else {
            transaction.content = content
            delete transaction.rawHeaders['content-encoding']
          }

          // length
          transaction.rawHeaders['content-length'] = `${transaction.content.length}`

          // duration
          const bytesPerMs = resource.mbps ? (resource.mbps * 1024 * 1024) / 8 / 1000 : 0
          transaction.durationMs = bytesPerMs ? content.length / bytesPerMs : 0
        }
      } else {
        transaction.rawHeaders['content-length'] = '0'
        transaction.durationMs = 0
      }

      // Content-Type
      if (resource.contentTypeMime) {
        transaction.rawHeaders['content-type'] = stringifyContentTypeHeader(
          resource.contentTypeMime,
          resource.contentTypeCharset
        )
      }

      map.set(resource, transaction)
    }

    const tryToLoadTransaction = async (resource: Resource) => {
      try {
        await loadTransaction(resource)
      } catch (err) {
        logger().error({ err, resource }, `Loading transaction failed ${resource.url}: ${err.message}`)
      }
    }

    await Promise.all(resources.map(tryToLoadTransaction))

    const transactions: Transaction[] = resources.reduce<Transaction[]>((transactions, resource) => {
      const transaction = map.get(resource)
      if (transaction) transactions.push(transaction)
      return transactions
    }, [])

    return transactions
  }
}
