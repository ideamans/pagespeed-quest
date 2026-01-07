#!/usr/bin/env node

import { createWriteStream, mkdirSync, chmodSync, existsSync, unlinkSync } from 'fs'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'
import { extract } from 'tar'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const LOADSHOW_VERSION = 'v1.3.0'
const REPO = 'ideamans/go-loadshow'

function getPlatformInfo() {
  const platform = process.platform
  const arch = process.arch

  if (platform === 'darwin' && arch === 'arm64') {
    return { os: 'darwin', arch: 'arm64', ext: 'tar.gz' }
  } else if (platform === 'darwin' && arch === 'x64') {
    // macOS x64 is not available, fall back to arm64 (Rosetta 2)
    return { os: 'darwin', arch: 'arm64', ext: 'tar.gz' }
  } else if (platform === 'linux' && arch === 'x64') {
    return { os: 'linux', arch: 'amd64', ext: 'tar.gz' }
  } else if (platform === 'linux' && arch === 'arm64') {
    return { os: 'linux', arch: 'arm64', ext: 'tar.gz' }
  } else if (platform === 'win32' && arch === 'x64') {
    return { os: 'windows', arch: 'amd64', ext: 'zip' }
  } else {
    throw new Error(`Unsupported platform: ${platform} ${arch}`)
  }
}

async function downloadFile(url, destPath) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status} ${response.statusText}`)
  }
  const fileStream = createWriteStream(destPath)
  await pipeline(response.body, fileStream)
}

async function extractTarGz(archivePath, destDir) {
  const { execSync } = await import('child_process')
  execSync(`tar -xzf "${archivePath}" -C "${destDir}"`, { stdio: 'inherit' })
}

async function extractZip(archivePath, destDir) {
  const { execSync } = await import('child_process')
  execSync(`unzip -o "${archivePath}" -d "${destDir}"`, { stdio: 'inherit' })
}

async function main() {
  const binDir = join(__dirname, '..', 'bin')
  const platformInfo = getPlatformInfo()

  const assetName = `loadshow_${LOADSHOW_VERSION}_${platformInfo.os}_${platformInfo.arch}.${platformInfo.ext}`
  const downloadUrl = `https://github.com/${REPO}/releases/download/${LOADSHOW_VERSION}/${assetName}`

  console.log(`Downloading go-loadshow ${LOADSHOW_VERSION} for ${platformInfo.os}/${platformInfo.arch}...`)
  console.log(`URL: ${downloadUrl}`)

  // Create bin directory if not exists
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true })
  }

  const archivePath = join(binDir, assetName)
  const binaryName = platformInfo.os === 'windows' ? 'loadshow.exe' : 'loadshow'
  const binaryPath = join(binDir, binaryName)

  // Download archive
  await downloadFile(downloadUrl, archivePath)
  console.log('Download complete. Extracting...')

  // Extract archive
  if (platformInfo.ext === 'tar.gz') {
    await extractTarGz(archivePath, binDir)
  } else {
    await extractZip(archivePath, binDir)
  }

  // Make binary executable (Unix only)
  if (platformInfo.os !== 'windows') {
    chmodSync(binaryPath, 0o755)
  }

  // Clean up archive
  unlinkSync(archivePath)

  console.log(`go-loadshow installed successfully at ${binaryPath}`)
}

main().catch((err) => {
  console.error('Failed to install go-loadshow:', err.message)
  process.exit(1)
})
