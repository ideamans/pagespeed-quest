import Zlib from 'zlib'

export type ContentEncodingType = 'gzip' | 'compress' | 'deflate' | 'br' | 'identity'

export interface ContentEncodingPair {
  compress: typeof Zlib.gzip
  decompress: typeof Zlib.gunzip
}

export const ContentEncodingMap = new Map<ContentEncodingType, ContentEncodingPair>()

ContentEncodingMap.set('gzip', {
  compress: Zlib.gzip,
  decompress: Zlib.gunzip,
})

ContentEncodingMap.set('compress', {
  compress: Zlib.gzip,
  decompress: Zlib.gunzip,
})

ContentEncodingMap.set('deflate', {
  compress: Zlib.deflate,
  decompress: Zlib.inflate,
})

ContentEncodingMap.set('br', {
  compress: Zlib.brotliCompress,
  decompress: Zlib.brotliDecompress,
})

export async function compress(type: ContentEncodingType, buffer: Buffer): Promise<Buffer> {
  const pair = ContentEncodingMap.get(type)
  if (!pair) return Buffer.from(buffer)

  return new Promise((resolve, reject) => {
    pair.compress(buffer, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}

export async function decompress(type: ContentEncodingType, buffer: Buffer): Promise<Buffer> {
  const pair = ContentEncodingMap.get(type)
  if (!pair) return Buffer.from(buffer)

  return new Promise((resolve, reject) => {
    pair.decompress(buffer, (err, result) => {
      if (err) return reject(err)
      resolve(result)
    })
  })
}
