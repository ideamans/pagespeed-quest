import Path from 'path'

import puppeteer from 'puppeteer'

import { DependencyInterface } from './types.js'

export interface CaptureLighthouseDigestInput {
  htmlPath: string
  outputPath: string
}

/**
 * Captures a digest screenshot of the Lighthouse report.
 * This function captures two specific sections:
 * 1. The final screenshot header (lh-category-header__finalscreenshot)
 * 2. The metrics audit group (lh-audit-group--metrics)
 */
export async function captureLighthouseDigest(
  opts: CaptureLighthouseDigestInput,
  dependency: Pick<DependencyInterface, 'logger' | 'mkdirp'>
): Promise<void> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()

    // Load the HTML file
    const fileUrl = `file://${Path.resolve(opts.htmlPath)}`
    await page.goto(fileUrl, { waitUntil: 'networkidle0' })

    // Check if the required elements exist
    const elementsExist = await page.evaluate(() => {
      const finalScreenshot = document.querySelector('.lh-category-header__finalscreenshot')
      const metrics = document.querySelector('.lh-audit-group--metrics')
      return finalScreenshot !== null && metrics !== null
    })

    if (!elementsExist) {
      throw new Error('Required elements not found in the Lighthouse report')
    }

    // Get the bounding boxes of both elements
    const finalScreenshotElement = await page.$('.lh-category-header__finalscreenshot')
    const metricsElement = await page.$('.lh-audit-group--metrics')

    if (!finalScreenshotElement || !metricsElement) {
      throw new Error('Required elements not found in the Lighthouse report')
    }

    const finalScreenshotBox = await finalScreenshotElement.boundingBox()
    const metricsBox = await metricsElement.boundingBox()

    if (!finalScreenshotBox || !metricsBox) {
      throw new Error('Could not get bounding box of required elements')
    }

    // Calculate the bounding box that encompasses both elements
    const minX = Math.min(finalScreenshotBox.x, metricsBox.x)
    const minY = Math.min(finalScreenshotBox.y, metricsBox.y)
    const maxX = Math.max(finalScreenshotBox.x + finalScreenshotBox.width, metricsBox.x + metricsBox.width)
    const maxY = Math.max(finalScreenshotBox.y + finalScreenshotBox.height, metricsBox.y + metricsBox.height)

    const boundingBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }

    // Ensure output directory exists
    const outputDir = Path.dirname(opts.outputPath)
    await dependency.mkdirp(outputDir)

    // Capture the screenshot
    await page.screenshot({
      path: opts.outputPath,
      clip: {
        x: boundingBox.x,
        y: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height,
      },
    })

    dependency.logger?.info(`Lighthouse digest screenshot saved to ${opts.outputPath}`)
  } finally {
    await browser.close()
  }
}
