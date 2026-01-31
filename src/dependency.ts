import Fsp from 'fs/promises'
import Path from 'path'
import { fileURLToPath } from 'url'

import { execa } from 'execa'
import Pino from 'pino'

import { DependencyInterface } from './types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = Path.dirname(__filename)
const packageBinDir = Path.resolve(__dirname, '..', 'bin')

export class Dependency implements DependencyInterface {
  logger?: Pino.Logger

  constructor() {
    this.logger = Pino({
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          hideObject: !['', '0', 'false', 'no'].includes(process.env.LOG_OBJECTS?.toLowerCase()),
        },
      },
    })
  }

  async mkdirp(dirPath: string): Promise<void> {
    await Fsp.mkdir(dirPath, { recursive: true })
  }

  async executeLighthouse(args: string[]): Promise<void> {
    const lighthousePath = process.env.LIGHTHOUSE_PATH || './node_modules/.bin/lighthouse'
    await execa(lighthousePath, args, { stdout: 'inherit', stderr: 'inherit' })
  }

  async executeLoadshow(args: string[]): Promise<void> {
    const binaryName = process.platform === 'win32' ? 'loadshow.exe' : 'loadshow'
    const loadshowPath = process.env.LOADSHOW_PATH || Path.join(packageBinDir, binaryName)
    await execa(loadshowPath, args, { stdout: 'inherit', stderr: 'inherit' })
  }

  async executeWebshot(args: string[]): Promise<void> {
    const binaryName = process.platform === 'win32' ? 'static-webshot.exe' : 'static-webshot'
    const webshotPath = process.env.WEBSHOT_PATH || Path.join(packageBinDir, binaryName)
    await execa(webshotPath, args, { stdout: 'inherit', stderr: 'inherit' })
  }
}
