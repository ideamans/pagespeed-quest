import Fsp from 'fs/promises'

import Execa from 'execa'

import { withPlaybackProxy } from './playback'
import { withRecordingProxy } from './recording'

async function runLighthouse(url: string, port: number) {
  await Execa('./node_modules/.bin/lighthouse', [
    '--output=html',
    '--output-path=tmp/lighthouse.html',
    '--only-categories=performance',
    '--form-factor=mobile',
    `--chrome-flags="--ignore-certificate-errors --proxy-server=http://localhost:${port}"`,
    '--view',
    url,
  ])
}

export async function recording() {
  const sampleUrl = 'https://www.gov-online.go.jp/'
  // const sampleUrl = 'https://blog.ideamans.com/'

  await Fsp.mkdir('./tmp', { recursive: true })
  await withRecordingProxy(
    async (proxy) => {
      proxy.entryUrl = sampleUrl
      await runLighthouse(sampleUrl, proxy.port)
    },
    {
      dirPath: './tmp',
    }
  )
}

export async function playback() {
  await withPlaybackProxy(
    async (proxy) => {
      if (!proxy.entryUrl) throw new Error('proxy.entryUrl is empty')
      await runLighthouse(proxy.entryUrl, proxy.port)
    },
    {
      dirPath: './tmp',
      throttling: {
        mbps: 1.6,
      },
    }
  )
}

playback()
