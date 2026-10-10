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

const silentDependency = {
  logger: {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  } as unknown as DependencyInterface['logger'],
  mkdirp: async () => undefined,
}

const playbackResources: Resource[] = [{ method: 'GET', url: 'https://example.com/', ttfbMs: 100 }]

test('generateLighthouseSummary - traffic comes from the bytes Lighthouse observed', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-summary-test-')
  const jsonPath = Path.join(tmpDir, 'lighthouse.report.json')
  const outputPath = Path.join(tmpDir, 'summary.md')

  try {
    const report: LighthouseReport = {
      categories: { performance: { id: 'performance', title: 'Performance', score: 0.8 } },
      audits: {
        'network-requests': {
          id: 'network-requests',
          title: 'Network Requests',
          score: null,
          details: {
            items: [
              { url: 'https://example.com/', resourceType: 'Document', transferSize: 1200, resourceSize: 5000 },
              { url: 'https://example.com/a.css', resourceType: 'Stylesheet', transferSize: 800, resourceSize: 4000 },
              { url: 'https://example.com/a.js', resourceType: 'Script', transferSize: 3000, resourceSize: 9000 },
              { url: 'https://cdn.example.com/b.js', resourceType: 'Script', transferSize: 2000, resourceSize: 6000 },
              { url: 'https://example.com/x.webp', resourceType: 'Image', transferSize: 10240, resourceSize: 10000 },
              { url: 'https://example.com/f.woff2', mimeType: 'font/woff2', transferSize: 500, resourceSize: 480 },
              // never crossed the network
              { url: 'data:image/png;base64,AAAA', resourceType: 'Image', transferSize: 0, resourceSize: 3 },
            ],
          },
        },
      },
    }
    await fs.writeFile(jsonPath, JSON.stringify(report), 'utf-8')

    await generateLighthouseSummary({ jsonPath, outputPath, resources: playbackResources }, silentDependency)

    const content = await fs.readFile(outputPath, 'utf-8')
    const section = (title: string) => content.split(`## ${title}: Type / Count / Size / Bytes`)[1].split('\n\n')[1]

    const traffic = section('Traffic')
    t.true(traffic.includes('- document / 1 / 1.2 KB / 1200'))
    t.true(traffic.includes('- stylesheet / 1 / 800 B / 800'))
    t.true(traffic.includes('- script / 2 / 4.9 KB / 5000'))
    t.true(traffic.includes('- image / 1 / 10.0 KB / 10240'))
    t.true(traffic.includes('- font / 1 / 500 B / 500'))
    t.true(traffic.includes('- **total** / 6 / 17.3 KB / 17740'))

    const resource = section('Resource')
    t.true(resource.includes('- script / 2 / 14.6 KB / 15000'))
    t.true(resource.includes('- **total** / 6 / 33.7 KB / 34480'))
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true })
  }
})

test('generateLighthouseSummary - no traffic section when the report has no network requests', async (t) => {
  const tmpDir = await fs.mkdtemp('/tmp/lighthouse-summary-test-')
  const jsonPath = Path.join(tmpDir, 'lighthouse.report.json')
  const outputPath = Path.join(tmpDir, 'summary.md')

  try {
    const report: LighthouseReport = {
      categories: { performance: { id: 'performance', title: 'Performance', score: 0.8 } },
      audits: {},
    }
    await fs.writeFile(jsonPath, JSON.stringify(report), 'utf-8')

    await generateLighthouseSummary({ jsonPath, outputPath, resources: playbackResources }, silentDependency)

    const content = await fs.readFile(outputPath, 'utf-8')
    t.true(content.includes('# Lighthouse Performance Summary'))
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
