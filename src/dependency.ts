import Fsp from 'fs/promises'

import { execa } from 'execa'
import Pino from 'pino'

import { DependencyInterface } from './types.js'

export class Dependency implements DependencyInterface {
  logger?: Pino.Logger

  async mkdirp(dirPath: string): Promise<void> {
    await Fsp.mkdir(dirPath, { recursive: true })
  }

  async executeLighthouse(args: string[]): Promise<void> {
    const lighthousePath = process.env.LIGHTHOUSE_PATH || './node_modules/.bin/lighthouse'
    await execa(lighthousePath, args, { stdout: 'inherit', stderr: 'inherit' })
  }

  async executeLoadshow(args: string[]): Promise<void> {
    const loadshowPath = process.env.LOADSHOW_PATH || './node_modules/.bin/loadshow'
    await execa(loadshowPath, args, { stdout: 'inherit', stderr: 'inherit' })
  }
}
