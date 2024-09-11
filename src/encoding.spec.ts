import test from 'ava'

import { compress, decompress } from './encoding.js'

test('Gzip encoding', async (t) => {
  const original = Buffer.from('x'.repeat(1000))

  const encoded = await compress('gzip', original)
  t.is(encoded.length, 29)

  const decoded = await decompress('gzip', encoded)
  t.deepEqual(decoded, original)
})

test('Deflate encoding', async (t) => {
  const original = Buffer.from('x'.repeat(1000))

  const encoded = await compress('deflate', original)
  t.is(encoded.length, 17)

  const decoded = await decompress('deflate', encoded)
  t.deepEqual(decoded, original)
})

test('Brotli encoding', async (t) => {
  const original = Buffer.from('x'.repeat(1000))

  const encoded = await compress('br', original)
  t.is(encoded.length, 11)

  const decoded = await decompress('br', encoded)
  t.deepEqual(decoded, original)
})

test('Identity encoding', async (t) => {
  const original = Buffer.from('x'.repeat(1000))

  const encoded = await compress('identity', original)
  t.is(encoded.length, 1000)

  const decoded = await decompress('identity', encoded)
  t.deepEqual(decoded, original)
})
