import Fsp from 'fs/promises'
import Path from 'path'

import test from 'ava'
import Tmp from 'tmp-promise'

import { Inventory, InventoryRepository, Transaction } from './inventory.js'

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
