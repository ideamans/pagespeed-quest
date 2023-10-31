import { Transform, TransformCallback } from 'stream'

export class ThrottlingLog {
  ms: number
  bytes: number
}

export class Throttle {
  flushIntervalMs!: number
  limitBytes!: number
  currentBytes = 0
  interval?: ReturnType<typeof setInterval>
  logs: ThrottlingLog[] = []

  constructor(limitBytes: number, flushIntervalMs?: number) {
    this.limitBytes = limitBytes
    this.flushIntervalMs = flushIntervalMs ?? 100
  }

  static fromMbps(mbps: number, flushIntervalMs?: number) {
    const bytesPerSec = (mbps * 1024 * 1024) / 8
    const limitBytes = Math.floor((bytesPerSec * flushIntervalMs) / 1000)
    return new Throttle(limitBytes, flushIntervalMs)
  }

  computeCapacity(): { consumed: number; carryover: number } {
    const consumed = Math.min(this.currentBytes, this.limitBytes)
    const carryover = this.currentBytes - consumed
    return { consumed, carryover }
  }

  start() {
    this.interval = setInterval(() => {
      const c = this.computeCapacity()
      this.logs.push({
        ms: Date.now(),
        bytes: c.consumed,
      })
      this.currentBytes = c.carryover
    }, this.flushIntervalMs)
  }

  stop() {
    if (this.interval) clearInterval(this.interval)
  }

  checkAndStack(bytes: number): boolean {
    if (!this.interval) throw new Error('Throttle is not started')
    if (this.currentBytes >= this.limitBytes) {
      return false
    }
    this.currentBytes += bytes
    return true
  }

  simpleReport(unitMs = 1000) {
    const bySec: Map<number, number> = new Map()
    for (const log of this.logs) {
      const unit = Math.floor(log.ms / unitMs)
      if (!bySec.has(unit)) bySec.set(unit, 0)
      bySec.set(unit, bySec.get(unit) + log.bytes)
    }

    const values = Array.from(bySec.values())
    const maxBytesPerUnit = Math.max(...values)
    const avgBytesPerUnit = Math.floor(values.reduce((a, b) => a + b, 0) / bySec.size) / 1024 / 1024

    return {
      maxBytesPerUnit,
      avgBytesPerUnit,
    }
  }
}

export class ThrottlingTransform extends Transform {
  throttle!: Throttle
  retryIntervalMs!: number

  constructor(throttle: Throttle, retryIntervalMs: number) {
    super()
    this.throttle = throttle
    this.retryIntervalMs = retryIntervalMs
  }

  _transform(chunk: string | Buffer, _: string, done: TransformCallback): void {
    if (this.throttle.checkAndStack(chunk.length)) {
      this.push(chunk)
      done()
      return
    }

    const interval = setInterval(() => {
      if (this.throttle.checkAndStack(chunk.length)) {
        clearInterval(interval)
        this.push(chunk)
        done()
      }
    })
  }
}
