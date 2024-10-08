import test from 'ava'

import { execLighthouse, ExecLighthouseInput } from './lighthouse.js'

test('lighthouse - default', async (t) => {
  const input: ExecLighthouseInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    headless: false,
    timeout: 60000,
  }
  await execLighthouse(input, {
    mkdirp: async (path: string) => {
      t.is(path, './artifacts')
    },
    executeLighthouse: async (args: string[]) => {
      t.deepEqual(args, [
        'https://example.com',
        '--save-assets',
        '--output=html,json',
        '--output-path=artifacts/lighthouse',
        '--only-categories=performance',
        '--form-factor=mobile',
        '--max-wait-for-load=60000',
        '--chrome-flags="--ignore-certificate-errors --proxy-server=http://localhost:8080"',
      ])
    },
  })
})

test('lighthouse - desktop', async (t) => {
  const input: ExecLighthouseInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    deviceType: 'desktop',
    headless: false,
    timeout: 30000,
  }
  await execLighthouse(input, {
    mkdirp: async (path: string) => {
      t.is(path, './artifacts')
    },
    executeLighthouse: async (args: string[]) => {
      t.deepEqual(args, [
        'https://example.com',
        '--save-assets',
        '--output=html,json',
        '--output-path=artifacts/lighthouse',
        '--only-categories=performance',
        '--form-factor=desktop',
        '--max-wait-for-load=30000',
        '--chrome-flags="--ignore-certificate-errors --proxy-server=http://localhost:8080"',
      ])
    },
  })
})

test('lighthouse - noThrottling, headless', async (t) => {
  const input: ExecLighthouseInput = {
    url: 'https://example.com',
    proxyPort: 8080,
    noThrottling: true,
    headless: true,
    timeout: 30000,
  }
  await execLighthouse(input, {
    mkdirp: async (path: string) => {
      t.is(path, './artifacts')
    },
    executeLighthouse: async (args: string[]) => {
      t.deepEqual(args, [
        'https://example.com',
        '--save-assets',
        '--output=html,json',
        '--output-path=artifacts/lighthouse',
        '--only-categories=performance',
        '--form-factor=mobile',
        '--throttling.rttMs=0',
        '--throttling.throughputKbps=0',
        '--throttling.downloadThroughputKbps=0',
        '--throttling.uploadThroughputKbps=0',
        '--throttling.cpuSlowdownMultiplier=1',
        '--max-wait-for-load=30000',
        '--chrome-flags="--ignore-certificate-errors --proxy-server=http://localhost:8080 --headless"',
      ])
    },
  })
})
