export type FormFactorType = 'desktop' | 'mobile'

export interface DependencyInterface {
  mkdirp(dirPath: string): Promise<void>

  executeLighthouse(args: string[]): Promise<void>
  executeLoadshow(args: string[]): Promise<void>
}
