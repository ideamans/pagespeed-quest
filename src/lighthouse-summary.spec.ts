import fs from 'fs/promises'
import Path from 'path'

import test from 'ava'

import { Resource } from './inventory.js'
import { generateLighthouseSummary, LighthouseReport } from './lighthouse-summary.js'
import { DependencyInterface } from './types.js'

const createTestReport = (): LighthouseReport => ({
  categories: {
    performance: {
      id: 'performance',
      title: 'Performance',
      score: 0.87,
    },
  },
  audits: {
    'first-contentful-paint': {
      id: 'first-contentful-paint',
      title: 'First Contentful Paint',
      score: 0.95,
      numericValue: 1234.56,
      displayValue: '1.2 s',
    },
    'largest-contentful-paint': {
      id: 'largest-contentful-paint',
      title: 'Largest Contentful Paint',
      score: 0.72,
      numericValue: 2500,
      displayValue: '2.5 s',
    },
    'total-blocking-time': {
      id: 'total-blocking-time',
      title: 'Total Blocking Time',
      score: 0.88,
      numericValue: 150,
      displayValue: '150 ms',
    },
    'cumulative-layout-shift': {
      id: 'cumulative-layout-shift',
      title: 'Cumulative Layout Shift',
      score: 1.0,
      numericValue: 0.01,
      displayValue: '0.01',
    },
    'speed-index': {
      id: 'speed-index',
      title: 'Speed Index',
      score: 0.9,
      numericValue: 1800,
      displayValue: '1.8 s',
    },
  },
})

test('generateLighthouseSummary - creates summary markdown with metrics and scores', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-summary-test-')
  const jsonPath = Path.join(tmpDir, 'lighthouse.report.json')
  const outputPath = Path.join(tmpDir, 'summary.md')

  try {
    // Create test report JSON
    await fs.writeFile(jsonPath, JSON.stringify(createTestReport()), 'utf-8')

    await generateLighthouseSummary(
      {
        jsonPath,
        outputPath,
      },
      {
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        } as unknown as DependencyInterface['logger'],
        mkdirp: async () => undefined,
      }
    )

    // Check that the output file exists and has content
    const content = await fs.readFile(outputPath, 'utf-8')

    // Check structure
    t.true(content.includes('# Lighthouse Performance Summary'))
    t.true(content.includes('## Metrics'))
    t.true(content.includes('## Scores'))

    // Check metrics section (values in ms) - order: LCP, CLS, TBT, FCP, SI
    t.true(content.includes('- LCP 2500 ms'))
    t.true(content.includes('- CLS 0.010'))
    t.true(content.includes('- TBT 150 ms'))
    t.true(content.includes('- FCP 1235 ms'))
    t.true(content.includes('- SI 1800 ms'))

    // Check scores section - order: LCP, CLS, TBT, FCP, SI, Overall
    t.true(content.includes('- LCP 72 x0.25'))
    t.true(content.includes('- CLS 100 x0.25'))
    t.true(content.includes('- TBT 88 x0.30'))
    t.true(content.includes('- FCP 95 x0.10'))
    t.true(content.includes('- SI 90 x0.10'))
    t.true(content.includes('- **Overall** 87'))
  } finally {
    // Cleanup
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('generateLighthouseSummary - handles null scores', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-summary-test-')
  const jsonPath = Path.join(tmpDir, 'lighthouse.report.json')
  const outputPath = Path.join(tmpDir, 'summary.md')

  try {
    const report: LighthouseReport = {
      categories: {
        performance: {
          id: 'performance',
          title: 'Performance',
          score: null,
        },
      },
      audits: {
        'first-contentful-paint': {
          id: 'first-contentful-paint',
          title: 'First Contentful Paint',
          score: null,
          numericValue: 1234.56,
          displayValue: '1.2 s',
        },
      },
    }
    await fs.writeFile(jsonPath, JSON.stringify(report), 'utf-8')

    await generateLighthouseSummary(
      {
        jsonPath,
        outputPath,
      },
      {
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        } as unknown as DependencyInterface['logger'],
        mkdirp: async () => undefined,
      }
    )

    const content = await fs.readFile(outputPath, 'utf-8')
    t.true(content.includes('- **Overall** N/A'))
    t.true(content.includes('- FCP 1235 ms'))
    t.true(content.includes('- FCP N/A x0.10'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('generateLighthouseSummary - handles missing numericValue', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-summary-test-')
  const jsonPath = Path.join(tmpDir, 'lighthouse.report.json')
  const outputPath = Path.join(tmpDir, 'summary.md')

  try {
    const report: LighthouseReport = {
      categories: {
        performance: {
          id: 'performance',
          title: 'Performance',
          score: 0.5,
        },
      },
      audits: {
        'first-contentful-paint': {
          id: 'first-contentful-paint',
          title: 'First Contentful Paint',
          score: 0.8,
          // numericValue is missing
        },
      },
    }
    await fs.writeFile(jsonPath, JSON.stringify(report), 'utf-8')

    await generateLighthouseSummary(
      {
        jsonPath,
        outputPath,
      },
      {
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        } as unknown as DependencyInterface['logger'],
        mkdirp: async () => undefined,
      }
    )

    const content = await fs.readFile(outputPath, 'utf-8')
    t.true(content.includes('- FCP N/A'))
    t.true(content.includes('- FCP 80 x0.10'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('generateLighthouseSummary - handles missing metrics', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-summary-test-')
  const jsonPath = Path.join(tmpDir, 'lighthouse.report.json')
  const outputPath = Path.join(tmpDir, 'summary.md')

  try {
    const report: LighthouseReport = {
      categories: {
        performance: {
          id: 'performance',
          title: 'Performance',
          score: 0.75,
        },
      },
      audits: {
        // Only include some metrics
        'first-contentful-paint': {
          id: 'first-contentful-paint',
          title: 'First Contentful Paint',
          score: 0.9,
          numericValue: 1000,
        },
      },
    }
    await fs.writeFile(jsonPath, JSON.stringify(report), 'utf-8')

    await generateLighthouseSummary(
      {
        jsonPath,
        outputPath,
      },
      {
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        } as unknown as DependencyInterface['logger'],
        mkdirp: async () => undefined,
      }
    )

    const content = await fs.readFile(outputPath, 'utf-8')
    t.true(content.includes('- **Overall** 75'))
    t.true(content.includes('- FCP 1000 ms'))
    t.true(content.includes('- FCP 90 x0.10'))
    // Missing metrics should not appear
    t.false(content.includes('LCP'))
    t.false(content.includes('TBT'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('generateLighthouseSummary - CLS value formatted with 3 decimal places', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-summary-test-')
  const jsonPath = Path.join(tmpDir, 'lighthouse.report.json')
  const outputPath = Path.join(tmpDir, 'summary.md')

  try {
    const report: LighthouseReport = {
      categories: {
        performance: {
          id: 'performance',
          title: 'Performance',
          score: 0.8,
        },
      },
      audits: {
        'cumulative-layout-shift': {
          id: 'cumulative-layout-shift',
          title: 'Cumulative Layout Shift',
          score: 0.95,
          numericValue: 0.123456,
        },
      },
    }
    await fs.writeFile(jsonPath, JSON.stringify(report), 'utf-8')

    await generateLighthouseSummary(
      {
        jsonPath,
        outputPath,
      },
      {
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        } as unknown as DependencyInterface['logger'],
        mkdirp: async () => undefined,
      }
    )

    const content = await fs.readFile(outputPath, 'utf-8')
    // CLS should be formatted with 3 decimal places, no unit
    t.true(content.includes('- CLS 0.123'))
    t.false(content.includes('- CLS 0.123 ms'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('generateLighthouseSummary - includes traffic statistics when resources provided', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-summary-test-')
  const jsonPath = Path.join(tmpDir, 'lighthouse.report.json')
  const outputPath = Path.join(tmpDir, 'summary.md')
  const inventoryDir = Path.join(tmpDir, 'inventory')

  try {
    // Create minimal report
    const report: LighthouseReport = {
      categories: {
        performance: {
          id: 'performance',
          title: 'Performance',
          score: 0.8,
        },
      },
      audits: {},
    }
    await fs.writeFile(jsonPath, JSON.stringify(report), 'utf-8')

    // Create inventory directory and test files
    await fs.mkdir(inventoryDir, { recursive: true })
    await fs.mkdir(Path.join(inventoryDir, 'GET/https/example.com'), { recursive: true })

    // Create test content files
    const htmlContent = '<html><body>Hello World</body></html>'
    const cssContent = 'body { color: red; }'
    const jsContent = 'console.log("hello");'
    const imageContent = Buffer.alloc(1000) // 1KB fake image

    await fs.writeFile(Path.join(inventoryDir, 'GET/https/example.com/index.html'), htmlContent)
    await fs.writeFile(Path.join(inventoryDir, 'GET/https/example.com/style.css'), cssContent)
    await fs.writeFile(Path.join(inventoryDir, 'GET/https/example.com/app.js'), jsContent)
    await fs.writeFile(Path.join(inventoryDir, 'GET/https/example.com/image.png'), imageContent)

    const resources: Resource[] = [
      {
        method: 'GET',
        url: 'https://example.com/index.html',
        ttfbMs: 100,
        contentTypeMime: 'text/html',
        contentFilePath: 'GET/https/example.com/index.html',
      },
      {
        method: 'GET',
        url: 'https://example.com/style.css',
        ttfbMs: 50,
        contentTypeMime: 'text/css',
        contentFilePath: 'GET/https/example.com/style.css',
        contentEncoding: 'gzip',
      },
      {
        method: 'GET',
        url: 'https://example.com/app.js',
        ttfbMs: 50,
        contentTypeMime: 'application/javascript',
        contentFilePath: 'GET/https/example.com/app.js',
        contentEncoding: 'gzip',
      },
      {
        method: 'GET',
        url: 'https://example.com/image.png',
        ttfbMs: 200,
        contentTypeMime: 'image/png',
        contentFilePath: 'GET/https/example.com/image.png',
      },
    ]

    await generateLighthouseSummary(
      {
        jsonPath,
        outputPath,
        inventoryDir,
        resources,
      },
      {
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        } as unknown as DependencyInterface['logger'],
        mkdirp: async () => undefined,
      }
    )

    const content = await fs.readFile(outputPath, 'utf-8')

    // Check that traffic and resource sections exist with column headers
    t.true(content.includes('## Traffic: Type / Count / Size / Bytes'))
    t.true(content.includes('## Resource: Type / Count / Size / Bytes'))

    // Check resource types are present
    t.true(content.includes('document'))
    t.true(content.includes('stylesheet'))
    t.true(content.includes('script'))
    t.true(content.includes('image'))

    // Check totals are present
    t.true(content.includes('**total**'))

    // Check format includes both human-readable and raw bytes
    t.regex(content, /\d+(\.\d+)?\s*(B|KB|MB)/)
    t.regex(content, /- \*\*total\*\* \/ \d+ \/ .+ \/ \d+/)
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('generateLighthouseSummary - handles missing content files gracefully', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-summary-test-')
  const jsonPath = Path.join(tmpDir, 'lighthouse.report.json')
  const outputPath = Path.join(tmpDir, 'summary.md')
  const inventoryDir = Path.join(tmpDir, 'inventory')

  try {
    const report: LighthouseReport = {
      categories: {
        performance: {
          id: 'performance',
          title: 'Performance',
          score: 0.8,
        },
      },
      audits: {},
    }
    await fs.writeFile(jsonPath, JSON.stringify(report), 'utf-8')
    await fs.mkdir(inventoryDir, { recursive: true })

    // Resource with non-existent file
    const resources: Resource[] = [
      {
        method: 'GET',
        url: 'https://example.com/missing.html',
        ttfbMs: 100,
        contentTypeMime: 'text/html',
        contentFilePath: 'GET/https/example.com/missing.html',
      },
    ]

    await generateLighthouseSummary(
      {
        jsonPath,
        outputPath,
        inventoryDir,
        resources,
      },
      {
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        } as unknown as DependencyInterface['logger'],
        mkdirp: async () => undefined,
      }
    )

    const content = await fs.readFile(outputPath, 'utf-8')

    // Should still generate summary without traffic section (no valid files)
    t.true(content.includes('# Lighthouse Performance Summary'))
    // Traffic section should not be present since no files were found
    t.false(content.includes('## Traffic'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('generateLighthouseSummary - no traffic section when resources not provided', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-summary-test-')
  const jsonPath = Path.join(tmpDir, 'lighthouse.report.json')
  const outputPath = Path.join(tmpDir, 'summary.md')

  try {
    const report: LighthouseReport = {
      categories: {
        performance: {
          id: 'performance',
          title: 'Performance',
          score: 0.8,
        },
      },
      audits: {},
    }
    await fs.writeFile(jsonPath, JSON.stringify(report), 'utf-8')

    await generateLighthouseSummary(
      {
        jsonPath,
        outputPath,
        // No inventoryDir or resources provided
      },
      {
        logger: {
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        } as unknown as DependencyInterface['logger'],
        mkdirp: async () => undefined,
      }
    )

    const content = await fs.readFile(outputPath, 'utf-8')

    // Traffic section should not be present
    t.false(content.includes('## Traffic'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})
