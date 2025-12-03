import fs from 'fs/promises'
import Path from 'path'

import test from 'ava'

import { captureLighthouseDigest } from './lighthouse-digest.js'

// Create a minimal HTML file for testing
const createTestHTML = async (path: string) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    .lh-category-header { padding: 20px; background: #f0f0f0; margin: 10px; }
    .lh-category-header__finalscreenshot { border: 1px solid #ccc; }
    .lh-audit-group { margin: 20px; padding: 10px; background: #fff; }
    .lh-audit-group--metrics { border: 1px solid #ddd; }
  </style>
</head>
<body>
  <div class="lh-category-header lh-category-header__finalscreenshot">
    <h1>Final Screenshot</h1>
    <div style="width: 300px; height: 200px; background: #eee;">Screenshot Placeholder</div>
  </div>
  <div class="lh-audit-group lh-audit-group--metrics">
    <h2>Metrics</h2>
    <ul>
      <li>First Contentful Paint: 1.2s</li>
      <li>Speed Index: 2.4s</li>
      <li>Largest Contentful Paint: 3.1s</li>
    </ul>
  </div>
</body>
</html>`
  await fs.writeFile(path, html, 'utf-8')
}

test('captureLighthouseDigest - creates digest screenshot', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-digest-test-')
  const htmlPath = Path.join(tmpDir, 'test.html')
  const outputPath = Path.join(tmpDir, 'digest.png')

  try {
    await createTestHTML(htmlPath)

    await captureLighthouseDigest(
      {
        htmlPath,
        outputPath,
      },
      {
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        } as unknown as any,
        mkdirp: async () => undefined,
      }
    )

    // Check that the output file exists
    const stats = await fs.stat(outputPath)
    t.true(stats.isFile())
    t.true(stats.size > 0)
  } finally {
    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('captureLighthouseDigest - throws error when elements not found', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-digest-test-')
  const htmlPath = Path.join(tmpDir, 'test.html')
  const outputPath = Path.join(tmpDir, 'digest.png')

  try {
    // Create HTML without required elements
    await fs.writeFile(htmlPath, '<html><body><h1>No Lighthouse content</h1></body></html>', 'utf-8')

    await t.throwsAsync(
      async () => {
        await captureLighthouseDigest(
          {
            htmlPath,
            outputPath,
          },
          {
            logger: {
              info: () => undefined,
              warn: () => undefined,
              error: () => undefined,
            } as unknown as any,
            mkdirp: async () => undefined,
          }
        )
      },
      { message: /Required elements not found/ }
    )
  } finally {
    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
