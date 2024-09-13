import Pino from 'pino'

export type FormFactorType = 'desktop' | 'mobile'

export interface DependencyInterface {
  logger?: Pino.Logger

  mkdirp(dirPath: string): Promise<void>

  executeLighthouse(args: string[]): Promise<void>
  executeLoadshow(args: string[]): Promise<void>
}
