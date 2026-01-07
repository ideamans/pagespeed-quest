import test from 'ava'

import { normalizeUrl, parseContentTypeHeader, requestContentFilePath, stringifyContentTypeHeader } from './http.js'

test('normalizeUrl', (t) => {
  t.is(normalizeUrl('http://example.com/?ts=123').href, 'http://example.com/?ts=')
  t.is(normalizeUrl('http://example.com/?foo=foo&ts=123').href, 'http://example.com/?foo=foo&ts=')
  t.is(normalizeUrl('http://example.com/?foo=foo&ts=123&bar=bar').href, 'http://example.com/?foo=foo&ts=&bar=bar')
  // URL without query params
  t.is(normalizeUrl('http://example.com/').href, 'http://example.com/')
  // URL object as input
  t.is(normalizeUrl(new URL('http://example.com/?ts=123')).href, 'http://example.com/?ts=')
})

test('urlToContentFilePath', (t) => {
  const longParam = 'x'.repeat(1000)
  t.is(requestContentFilePath('get', 'http://example.com'), 'get/http/example.com/index.html')
  t.is(requestContentFilePath('post', 'http://example.com'), 'post/http/example.com/index.html')
  t.is(requestContentFilePath('get', 'http://example.com'), 'get/http/example.com/index.html')
  t.is(requestContentFilePath('get', 'https://example.com'), 'get/https/example.com/index.html')
  t.is(requestContentFilePath('get', 'https://example.com:8080'), 'get/https/example.com~8080/index.html')

  t.is(requestContentFilePath('get', 'http://example.com/'), 'get/http/example.com/index.html')
  t.is(requestContentFilePath('get', 'http://example.com/path/to'), 'get/http/example.com/path/to/index.html')
  t.is(requestContentFilePath('get', 'http://example.com/path/to/'), 'get/http/example.com/path/to/index.html')
  t.is(requestContentFilePath('get', 'http://example.com/path/to/image.jpg'), 'get/http/example.com/path/to/image.jpg')
  t.is(requestContentFilePath('get', 'http://example.com/path/to/image.jpg'), 'get/http/example.com/path/to/image.jpg')
  t.is(
    requestContentFilePath('get', 'http://example.com/path/to/image.jpg?ts=123'),
    'get/http/example.com/path/to/image~ts=.jpg'
  )
  t.is(
    requestContentFilePath('get', `http://example.com/path/to/image.jpg?${longParam}`),
    `get/http/example.com/path/to/image~xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx_b5114ebf.jpg`
  )
})

test('parseContentType', (t) => {
  t.deepEqual(parseContentTypeHeader('text/html'), { mime: 'text/html', charset: undefined })
  t.deepEqual(parseContentTypeHeader('text/html; charset=utf-8'), { mime: 'text/html', charset: 'utf-8' })
})

test('stringifyContentType', (t) => {
  t.is(stringifyContentTypeHeader('text/html'), 'text/html')
  t.is(stringifyContentTypeHeader('text/html', 'utf-8'), 'text/html; charset=utf-8')
  t.is(
    stringifyContentTypeHeader('text/html', 'utf-8', 'text/html; charset=ascii; foo=bar'),
    'text/html; charset=utf-8; foo=bar'
  )
  t.is(stringifyContentTypeHeader('text/html', 'utf-8', 'text/html; foo=bar'), 'text/html; charset=utf-8; foo=bar')
})
