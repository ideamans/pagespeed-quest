import Fsp from 'fs/promises'
import Path from 'path'
import { promisify } from 'util'
import Zlib from 'zlib'

import test from 'ava'
import Tmp from 'tmp-promise'

import { Inventory, InventoryRepository, Resource, Transaction } from './inventory.js'

const gzip = promisify(Zlib.gzip)

test('Save and load inventory', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const inventoryRepository = new InventoryRepository(tmp.path)
      const saving: Inventory = {
        entryUrl: 'http://example.com/',
        deviceType: 'desktop',
        resources: [
          {
            method: 'get',
            url: 'http://example.com/',
            ttfbMs: 100,
            mbps: 50,
            statusCode: 200,
            rawHeaders: {
              'content-type': 'text/html; charset=utf-8',
            },
            contentEncoding: 'gzip',
            contentTypeMime: 'text/html',
            contentTypeCharset: 'utf-8',
            contentFilePath: 'get/http/example.com/index.html',
          },
        ],
      }

      await inventoryRepository.saveInventory(saving)

      const loaded = await inventoryRepository.loadInventory()
      t.deepEqual(loaded, saving)
    },
    { unsafeCleanup: true }
  )
})

test('Transactions and resources', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const inventoryRepository = new InventoryRepository(tmp.path)
      const savingTransactions: Transaction[] = [
        {
          method: 'get',
          url: 'http://example.com/',
          ttfbMs: 100,
          statusCode: 200,
          rawHeaders: {
            'content-type': 'text/html; charset=utf-8',
          },
          content: Buffer.from('<html><body>Hello World</body></html>'),
          durationMs: 1000,
        },
        {
          method: 'get',
          url: 'http://example.com/no-content.html',
          ttfbMs: 110,
          statusCode: 200,
          rawHeaders: {
            'content-type': 'text/html; charset=utf-8',
          },
        },
      ]

      const resources = await inventoryRepository.saveTransactions(savingTransactions)
      t.deepEqual(resources, [
        {
          method: 'get',
          url: 'http://example.com/',
          ttfbMs: 100,
          statusCode: 200,
          errorMessage: undefined,
          rawHeaders: { 'content-type': 'text/html; charset=utf-8' },
          contentTypeMime: 'text/html',
          contentTypeCharset: 'utf-8',
          mbps: 0.00028228759765625,
          contentFilePath: 'get/http/example.com/index.html',
        },
        {
          method: 'get',
          url: 'http://example.com/no-content.html',
          ttfbMs: 110,
          statusCode: 200,
          errorMessage: undefined,
          rawHeaders: { 'content-type': 'text/html; charset=utf-8' },
          contentTypeMime: 'text/html',
          contentTypeCharset: 'utf-8',
        },
      ])

      const content = await Fsp.readFile(Path.join(tmp.path, resources[0].contentFilePath), 'utf8')
      t.is(
        content,
        `<html>
  <body>
    Hello World
  </body>
</html>
`
      )

      const loaded = await inventoryRepository.loadTransactions(resources)
      t.deepEqual(loaded, [
        {
          method: 'get',
          url: 'http://example.com/',
          ttfbMs: 100,
          statusCode: 200,
          errorMessage: undefined,
          rawHeaders: { 'content-length': '50', 'content-type': 'text/html; charset=utf-8' },
          durationMs: 1351.3513513513515,
          content: Buffer.from(`<html>
  <body>
    Hello World
  </body>
</html>
`),
        },
        {
          method: 'get',
          url: 'http://example.com/no-content.html',
          ttfbMs: 110,
          statusCode: 200,
          errorMessage: undefined,
          rawHeaders: { 'content-length': '0', 'content-type': 'text/html; charset=utf-8' },
          durationMs: 0,
        },
      ])
    },
    { unsafeCleanup: true }
  )
})

test('contentUtf8 and contentBase64', async (t) => {
  await Tmp.withDir(async (tmp) => {
    const inventoryRepository = new InventoryRepository(tmp.path)
    const inventory: Inventory = {
      resources: [
        {
          method: 'get',
          url: 'http://example.com/',
          ttfbMs: 100,
          statusCode: 200,
          rawHeaders: {
            'content-type': 'text/html; charset=utf-8',
          },
          contentUtf8: '<html><body>Hello World</body></html>',
        },
        {
          method: 'get',
          url: 'http://example.com/hello',
          ttfbMs: 100,
          statusCode: 200,
          rawHeaders: {
            'content-type': 'text/plain',
          },
          contentBase64: 'aGVsbG8K', // hello
        },
      ],
    }

    const transactions = await inventoryRepository.loadTransactions(inventory.resources)

    t.deepEqual(transactions, [
      {
        method: 'get',
        url: 'http://example.com/',
        ttfbMs: 100,
        statusCode: 200,
        errorMessage: undefined,
        rawHeaders: { 'content-length': '37', 'content-type': 'text/html; charset=utf-8' },
        durationMs: 0,
        content: Buffer.from('<html><body>Hello World</body></html>'),
      },
      {
        method: 'get',
        url: 'http://example.com/hello',
        ttfbMs: 100,
        statusCode: 200,
        errorMessage: undefined,
        rawHeaders: { 'content-length': '6', 'content-type': 'text/plain' },
        durationMs: 0,
        content: Buffer.from('hello\n'),
      },
    ])
  })
})

test('Load inventory - fallback to legacy index.json', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const inventoryRepository = new InventoryRepository(tmp.path)
      const inventory: Inventory = {
        entryUrl: 'http://example.com/',
        resources: [],
      }

      // Only write index.json (legacy format), not inventory.json
      await Fsp.writeFile(Path.join(tmp.path, 'index.json'), JSON.stringify(inventory))

      const loaded = await inventoryRepository.loadInventory()
      t.deepEqual(loaded, inventory)
    },
    { unsafeCleanup: true }
  )
})

test('Transaction with content-encoding gzip', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const inventoryRepository = new InventoryRepository(tmp.path)
      const originalContent = '<html><body>Compressed Content</body></html>'
      const compressedContent = await gzip(Buffer.from(originalContent))

      const savingTransactions: Transaction[] = [
        {
          method: 'get',
          url: 'http://example.com/compressed',
          ttfbMs: 100,
          statusCode: 200,
          rawHeaders: {
            'content-type': 'text/html; charset=utf-8',
            'content-encoding': 'gzip',
          },
          content: compressedContent,
          durationMs: 500,
        },
      ]

      const resources = await inventoryRepository.saveTransactions(savingTransactions)
      t.is(resources.length, 1)
      t.is(resources[0].contentEncoding, 'gzip')

      // Verify content was decompressed and saved
      const savedContent = await Fsp.readFile(Path.join(tmp.path, resources[0].contentFilePath!), 'utf8')
      t.true(savedContent.includes('Compressed Content'))
    },
    { unsafeCleanup: true }
  )
})

test('Load transaction with content-encoding', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const inventoryRepository = new InventoryRepository(tmp.path)
      const contentFilePath = 'get/http/example.com/index.html'
      const fullPath = Path.join(tmp.path, contentFilePath)

      await Fsp.mkdir(Path.dirname(fullPath), { recursive: true })
      await Fsp.writeFile(fullPath, '<html><body>Test</body></html>')

      const resources: Resource[] = [
        {
          method: 'get',
          url: 'http://example.com/',
          ttfbMs: 100,
          statusCode: 200,
          rawHeaders: {},
          contentTypeMime: 'text/html',
          contentTypeCharset: 'utf-8',
          contentEncoding: 'gzip',
          contentFilePath,
          mbps: 10,
        },
      ]

      const transactions = await inventoryRepository.loadTransactions(resources)
      t.is(transactions.length, 1)
      t.is(transactions[0].rawHeaders['content-encoding'], 'gzip')
      // Content should be compressed
      t.true(transactions[0].content!.length > 0)
    },
    { unsafeCleanup: true }
  )
})

test('Default inventory directory path', (t) => {
  const inventoryRepository = new InventoryRepository()
  t.true(inventoryRepository.dirPath.endsWith('inventory'))
})

test('Transaction without content', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const inventoryRepository = new InventoryRepository(tmp.path)
      const savingTransactions: Transaction[] = [
        {
          method: 'get',
          url: 'http://example.com/empty',
          ttfbMs: 100,
          statusCode: 204,
          rawHeaders: {},
        },
      ]

      const resources = await inventoryRepository.saveTransactions(savingTransactions)
      t.is(resources.length, 1)
      t.is(resources[0].contentFilePath, undefined)
    },
    { unsafeCleanup: true }
  )
})

test('Transaction with binary content (non-text)', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const inventoryRepository = new InventoryRepository(tmp.path)
      const binaryContent = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) // PNG header

      const savingTransactions: Transaction[] = [
        {
          method: 'get',
          url: 'http://example.com/image.png',
          ttfbMs: 100,
          statusCode: 200,
          rawHeaders: {
            'content-type': 'image/png',
          },
          content: binaryContent,
          durationMs: 100,
        },
      ]

      const resources = await inventoryRepository.saveTransactions(savingTransactions)
      t.is(resources.length, 1)
      t.is(resources[0].contentTypeMime, 'image/png')

      // Verify binary content was saved correctly
      const savedContent = await Fsp.readFile(Path.join(tmp.path, resources[0].contentFilePath!))
      t.deepEqual(savedContent, binaryContent)
    },
    { unsafeCleanup: true }
  )
})

test('Load transaction with missing file', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const inventoryRepository = new InventoryRepository(tmp.path)
      const resources: Resource[] = [
        {
          method: 'get',
          url: 'http://example.com/missing',
          ttfbMs: 100,
          statusCode: 200,
          rawHeaders: {},
          contentFilePath: 'get/http/example.com/missing.html',
        },
      ]

      const transactions = await inventoryRepository.loadTransactions(resources)
      t.is(transactions.length, 1)
      t.is(transactions[0].rawHeaders['content-length'], '0')
      t.is(transactions[0].durationMs, 0)
    },
    { unsafeCleanup: true }
  )
})
