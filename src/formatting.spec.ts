import test from 'ava'
import IconvLite from 'iconv-lite'

import { convertEditableText, ensureUtf8String } from './formatting'

test('tryToNormalizeAsUtf8', (t) => {
  {
    const shiftJis = IconvLite.encode('あいうえお日本語アイウエオ', 'shift_jis')
    const utf8 = ensureUtf8String(shiftJis, 'shift_jis')
    t.is(utf8, 'あいうえお日本語アイウエオ')
  }

  {
    const utf8 = Buffer.from('あいうえお日本語アイウエオ')
    const utf8_2 = ensureUtf8String(utf8, 'utf-8')
    t.is(utf8_2, 'あいうえお日本語アイウエオ')
  }

  {
    const ascii = IconvLite.encode('abc', 'ascii')
    const utf8 = ensureUtf8String(ascii, 'ascii')
    t.is(utf8, 'abc')
  }
})

test('Prettier HTML', async (t) => {
  const html =
    '<html><head><meta charset="shift_jis"></head><body><h1>title</h1><script charset="shift_jis">// script</script></body></html>'
  const beauty = await convertEditableText(Buffer.from(html), 'text/html')
  t.is(
    beauty.toString(),
    `<html>
  <head></head>
  <body>
    <h1>title</h1>
    <script>
      // script
    </script>
  </body>
</html>
`
  )
})

test('Prettier CSS', async (t) => {
  const css = 'body { color: red; }'
  const beauty = await convertEditableText(Buffer.from(css), 'text/css')
  t.is(
    beauty.toString(),
    `body {
  color: red;
}
`
  )
})

test('Prettier JS', async (t) => {
  const js = 'const foo = 1;const bar = 1;'
  const beauty = await convertEditableText(Buffer.from(js), 'application/javascript')
  t.is(
    beauty.toString(),
    `const foo = 1;
const bar = 1;
`
  )
})
