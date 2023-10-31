import Crypto from 'crypto'
import Path from 'path'

const DirectoryIndex = 'index.html'
const BasenameMaxLength = 196
const HashLength = 8
const IgnoreParams = process.env.IGNORE_PARAMS || 'ts'
const IgnoreParamsRegex = IgnoreParams.split(/\s*,\s*/).map((p) => new RegExp(`(?<=[?&]${p}=)[^&]*`, 'g'))

export type HttpHeaders = { [key: string]: string }

/**
 * Remove IgnoreParams from URL
 * Default: ts (timestamp) assumed different for each request
 * @param url
 * @returns
 */
export function normalizeUrl(url: string | URL): URL {
  const urlObj = typeof url === 'string' ? new URL(url) : url

  // Remove dynamic params
  if (urlObj.search !== '') {
    urlObj.search = IgnoreParamsRegex.reduce<string>((search, re) => {
      return search.replace(re, '')
    }, urlObj.search)
  }

  return urlObj
}

/**
 * Convert URL to content file path
 * For example:
 * https://example.com/foo/bar.html?hoge=123 -> example.com/foo/bar~hoge=123.html
 * - Add directory index (index.html) if URL ends with slash
 * - Shorten too long basename with short hash
 * - Ignore dynamic params for example: ts=123
 * @param url
 * @returns
 */
export function requestContentFilePath(method: string, url: string | URL): string {
  const urlObj = normalizeUrl(url)

  const protocol = urlObj.protocol.replace(/:/g, '')
  const host = urlObj.host.replace(/:/g, '~')

  // Directory Index (index.html)
  let pathname = urlObj.pathname
  if (pathname.endsWith('/')) {
    pathname += DirectoryIndex
  } else {
    const ext = Path.extname(pathname)
    if (ext === '') {
      pathname = Path.join(pathname, DirectoryIndex)
    }
  }

  const dir = Path.dirname(pathname)
  const ext = Path.extname(pathname)
  const base = Path.basename(pathname, ext)

  let filename = base

  // Search params
  if (urlObj.search !== '') {
    // Remove dynamic params
    const search = IgnoreParamsRegex.reduce<string>((search, re) => {
      return search.replace(re, '')
    }, urlObj.search)
    filename = [filename, search.slice(1)].join('~')
  }

  // Shorten too long basename
  if (filename.length > BasenameMaxLength) {
    const trunk = filename.slice(0, BasenameMaxLength)
    const hash = Crypto.createHash('sha1')
    hash.update(filename)
    const digest = hash.digest('hex').slice(0, HashLength)
    filename = [trunk, digest].join('_')
  }

  // Extension
  filename += ext

  // Content file relative path
  const relPath = Path.join(dir, filename)

  return Path.join(method, protocol, host, relPath)
}

export function parseContentTypeHeader(contentType: string) {
  const [mime, ...params] = contentType.split(/;/).map((s) => s.trim())
  const charsetParam = params.find((p) => p.startsWith('charset='))
  return {
    mime,
    charset: charsetParam ? charsetParam.slice('charset='.length) : undefined,
  }
}

export function stringifyContentTypeHeader(mime?: string, charset?: string, original?: string) {
  const params: string[] = original ? original.split(/;/).map((s) => s.trim()) : []
  if (mime) params[0] = mime
  if (charset) {
    const charsetParamIndex = params.findIndex((p) => p.startsWith('charset='))
    if (charsetParamIndex >= 0) params.splice(charsetParamIndex, 1, `charset=${charset}`)
    else params.splice(1, 0, `charset=${charset}`)
  }
  return params.join('; ')
}
