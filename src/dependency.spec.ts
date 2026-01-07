import Fsp from 'fs/promises'
import Path from 'path'

import test from 'ava'
import Tmp from 'tmp-promise'

import { Dependency } from './dependency.js'

test('Dependency constructor initializes logger', (t) => {
  const dependency = new Dependency()
  t.truthy(dependency.logger)
  t.is(typeof dependency.logger?.info, 'function')
  t.is(typeof dependency.logger?.error, 'function')
  t.is(typeof dependency.logger?.warn, 'function')
})

test('Dependency mkdirp creates directory', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const dependency = new Dependency()
      const newDir = Path.join(tmp.path, 'test', 'nested', 'dir')

      await dependency.mkdirp(newDir)

      const stat = await Fsp.stat(newDir)
      t.true(stat.isDirectory())
    },
    { unsafeCleanup: true }
  )
})

test('Dependency mkdirp does not throw if directory exists', async (t) => {
  await Tmp.withDir(
    async (tmp) => {
      const dependency = new Dependency()

      // Should not throw when directory already exists
      await t.notThrowsAsync(async () => {
        await dependency.mkdirp(tmp.path)
      })
    },
    { unsafeCleanup: true }
  )
})
