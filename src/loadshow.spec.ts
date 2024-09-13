import test from 'ava'

import { execLoadshow, ExecLoadshowInput } from './loadshow.js'

test('loadshow - default', async (t) => {
  const spec: ExecLoadshowInput = {
    url: 'https://example.com',
    proxyPort: 8080,
  }
  execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, './artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.deepEqual(args, [
        'record',
        '-a',
        './artifacts/loadshow',
        '-u',
        'layout.columns=3',
        '-u',
        'recording.viewportWidth=412',
        '-u',
        'recording.cpuThrottling=4',
        '-u',
        'recording.headers.User-Agent=Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
        '-u',
        'recording.puppeteer.args=--ignore-certificate-errors --proxy-server=http://localhost:8080',
        'https://example.com',
        './artifacts/loadshow.mp4',
      ])
    },
  })
})

test('loadshow - lighthouse', async (t) => {
  const spec: ExecLoadshowInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    syncLighthouseSpec: true,
  }
  execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, './artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.deepEqual(args, [
        'record',
        '-a',
        './artifacts/loadshow',
        '-u',
        'layout.columns=3',
        '-u',
        'recording.viewportWidth=412',
        '-u',
        'recording.cpuThrottling=4',
        '-u',
        'recording.network.latencyMs=150',
        '-u',
        'recording.network.uploadThroughputMbps=1.6',
        '-u',
        'recording.network.downloadThroughputMbps=1.6',
        '-u',
        'recording.headers.User-Agent=Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
        '-u',
        'recording.puppeteer.args=--ignore-certificate-errors --proxy-server=http://localhost:8080',
        'https://example.com',
        './artifacts/loadshow.mp4',
      ])
    },
  })
})

test('loadshow - desktop', async (t) => {
  const spec: ExecLoadshowInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    formFactor: 'desktop',
  }
  execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, './artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.deepEqual(args, [
        'record',
        '-a',
        './artifacts/loadshow',
        '-u',
        'layout.columns=2',
        '-u',
        'recording.viewportWidth=1350',
        '-u',
        'recording.cpuThrottling=1',
        '-u',
        'recording.headers.User-Agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        '-u',
        'recording.puppeteer.args=--ignore-certificate-errors --proxy-server=http://localhost:8080',
        'https://example.com',
        './artifacts/loadshow.mp4',
      ])
    },
  })
})

test('loadshow - desktop - lighthouse', async (t) => {
  const spec: ExecLoadshowInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    formFactor: 'desktop',
    syncLighthouseSpec: true,
  }
  execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, './artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.deepEqual(args, [
        'record',
        '-a',
        './artifacts/loadshow',
        '-u',
        'layout.columns=2',
        '-u',
        'recording.viewportWidth=1350',
        '-u',
        'recording.cpuThrottling=1',
        '-u',
        'recording.network.latencyMs=40',
        '-u',
        'recording.network.uploadThroughputMbps=10',
        '-u',
        'recording.network.downloadThroughputMbps=10',
        '-u',
        'recording.headers.User-Agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        '-u',
        'recording.puppeteer.args=--ignore-certificate-errors --proxy-server=http://localhost:8080',
        'https://example.com',
        './artifacts/loadshow.mp4',
      ])
    },
  })
})

test('loadshow - lighthouse - noThrottling', async (t) => {
  const spec: ExecLoadshowInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    syncLighthouseSpec: true,
    noThrottling: true,
  }
  execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, './artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.deepEqual(args, [
        'record',
        '-a',
        './artifacts/loadshow',
        '-u',
        'layout.columns=3',
        '-u',
        'recording.viewportWidth=412',
        '-u',
        'recording.cpuThrottling=4',
        '-u',
        'recording.network.latencyMs=0',
        '-u',
        'recording.network.uploadThroughputMbps=999999',
        '-u',
        'recording.network.downloadThroughputMbps=999999',
        '-u',
        'recording.headers.User-Agent=Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
        '-u',
        'recording.puppeteer.args=--ignore-certificate-errors --proxy-server=http://localhost:8080',
        'https://example.com',
        './artifacts/loadshow.mp4',
      ])
    },
  })
})
