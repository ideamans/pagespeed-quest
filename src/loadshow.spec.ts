import test from 'ava'

import { execLoadshow, ExecLoadshowInput } from './loadshow.js'

test('loadshow - default (mobile)', async (t) => {
  const spec: ExecLoadshowInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    timeout: 60000,
  }
  await execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, 'artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.deepEqual(args, [
        'record',
        '--preset',
        'mobile',
        '--columns',
        '3',
        '--timeout-sec',
        '60',
        '--proxy-server',
        'http://localhost:8080',
        '--ignore-https-errors',
        '--debug-dir',
        'artifacts/loadshow',
        '--output-summary',
        'artifacts/loadshow/summary.md',
        '--output',
        'artifacts/loadshow.mp4',
        'https://example.com',
      ])
    },
  })
})

test('loadshow - desktop', async (t) => {
  const spec: ExecLoadshowInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    deviceType: 'desktop',
    timeout: 30000,
  }
  await execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, 'artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.deepEqual(args, [
        'record',
        '--preset',
        'desktop',
        '--columns',
        '2',
        '--timeout-sec',
        '30',
        '--proxy-server',
        'http://localhost:8080',
        '--ignore-https-errors',
        '--debug-dir',
        'artifacts/loadshow',
        '--output-summary',
        'artifacts/loadshow/summary.md',
        '--output',
        'artifacts/loadshow.mp4',
        'https://example.com',
      ])
    },
  })
})

test('loadshow - with credit', async (t) => {
  const spec: ExecLoadshowInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    timeout: 30000,
    credit: 'Test Credit',
  }
  await execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, 'artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.deepEqual(args, [
        'record',
        '--preset',
        'mobile',
        '--columns',
        '3',
        '--timeout-sec',
        '30',
        '--proxy-server',
        'http://localhost:8080',
        '--ignore-https-errors',
        '--credit',
        'Test Credit',
        '--debug-dir',
        'artifacts/loadshow',
        '--output-summary',
        'artifacts/loadshow/summary.md',
        '--output',
        'artifacts/loadshow.mp4',
        'https://example.com',
      ])
    },
  })
})

test('loadshow - custom artifacts directory', async (t) => {
  const spec: ExecLoadshowInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    timeout: 30000,
    artifactsDir: './custom-artifacts',
  }
  await execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, 'custom-artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.true(args.includes('--output'))
      t.true(args.includes('custom-artifacts/loadshow.mp4'))
      t.true(args.includes('--debug-dir'))
      t.true(args.includes('custom-artifacts/loadshow'))
    },
  })
})
