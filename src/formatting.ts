import IconvLite from 'iconv-lite'
import Prettier from 'prettier'

const PrettierDefaultOptions = { printWidth: 120 }

export function ensureUtf8String(buffer: Buffer, charset: string): string {
  if (charset.match(/utf-?8/i) || charset.match(/ascii/i)) return buffer.toString('utf8')
  const converted = IconvLite.decode(buffer, charset)
  return converted
}

function isHtml(mimeType: string): boolean {
  if (!mimeType) return false
  return mimeType === 'text/html'
}

function isCss(mimeType: string): boolean {
  if (!mimeType) return false
  return mimeType === 'text/css'
}

function isJs(mimeType: string): boolean {
  if (!mimeType) return false
  return (
    mimeType === 'text/javascript' || mimeType === 'application/javascript' || mimeType === 'application/x-javascript'
  )
}

export function isText(mimeType: string): boolean {
  return isHtml(mimeType) || isCss(mimeType) || isJs(mimeType)
}

export interface BeautifyResult {
  content: Buffer
  charset?: string
}

export async function convertEditableText(
  content: Buffer,
  contentTypeMime: string,
  contentTypeCharset?: string
): Promise<Buffer> {
  const charset = contentTypeCharset || 'utf-8'
  if (isHtml(contentTypeMime)) {
    const utf8 = ensureUtf8String(content, charset)
    const withoutCharsetMeta = utf8.replace(/<meta charset="[^"]*">/, '')
    const withoutScriptCharsetAttr = withoutCharsetMeta.replace(/<script(?:.*)>/gi, (scriptTag) => {
      return scriptTag.replace(/\s*charset\s*=\s*(?:"[^"]*"|'[^']*'|[^ ]+)/i, '')
    })
    // TODO: consider charset attribute in link[rel=stylesheet]
    const html = await Prettier.format(withoutScriptCharsetAttr, { ...PrettierDefaultOptions, parser: 'html' })
    return html
  } else if (isCss(contentTypeMime)) {
    const utf8 = ensureUtf8String(content, charset)
    const withoutCharsetDirective = utf8.replace(/@charset "[^"]*";/, '')
    const css = await Prettier.format(withoutCharsetDirective, { ...PrettierDefaultOptions, parser: 'css' })
    return css
  } else if (isJs(contentTypeMime)) {
    const utf8 = ensureUtf8String(content, charset)
    const js = await Prettier.format(utf8, { ...PrettierDefaultOptions, parser: 'babel' })
    return js
  } else {
    throw new Error(`${contentTypeMime} is not supported text content type`)
  }
}
