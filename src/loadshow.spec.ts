import test from 'ava'

import { execLoadshow, ExecLoadshowInput } from './loadshow.js'

test('loadshow - default', async (t) => {
  const spec: ExecLoadshowInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    timeout: 60000,
  }
  execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, 'artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.deepEqual(args, [
        'record',
        '-a',
        'artifacts/loadshow',
        '-u',
        'layout.columns=3',
        '-u',
        'recording.viewportWidth=412',
        '-u',
        'recording.cpuThrottling=4',
        '-u',
        'recording.timeoutMs=60000',
        '-u',
        'recording.headers.User-Agent=Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
        '-u',
        'recording.puppeteer.args=--ignore-certificate-errors,--proxy-server=http://localhost:8080',
        'https://example.com',
        'artifacts/loadshow.mp4',
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
  execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, 'artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.deepEqual(args, [
        'record',
        '-a',
        'artifacts/loadshow',
        '-u',
        'layout.columns=2',
        '-u',
        'recording.viewportWidth=1350',
        '-u',
        'recording.cpuThrottling=1',
        '-u',
        'recording.timeoutMs=30000',
        '-u',
        'recording.headers.User-Agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
        '-u',
        'recording.puppeteer.args=--ignore-certificate-errors,--proxy-server=http://localhost:8080',
        'https://example.com',
        'artifacts/loadshow.mp4',
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
  execLoadshow(spec, {
    mkdirp: async (path: string) => {
      t.is(path, 'artifacts/loadshow')
    },
    executeLoadshow: async (args: string[]) => {
      t.deepEqual(args, [
        'record',
        '-a',
        'artifacts/loadshow',
        '-u',
        'layout.columns=3',
        '-u',
        'recording.viewportWidth=412',
        '-u',
        'recording.cpuThrottling=4',
        '-u',
        'recording.timeoutMs=30000',
        '-u',
        'recording.headers.User-Agent=Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36',
        '-u',
        'recording.puppeteer.args=--ignore-certificate-errors,--proxy-server=http://localhost:8080',
        '-u',
        'banner.vars.credit=Test Credit',
        'https://example.com',
        'artifacts/loadshow.mp4',
      ])
    },
  })
})
