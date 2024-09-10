import { Readable, Writable } from 'stream'

import test from 'ava'

import { Throttle, ThrottlingTransform } from './throttling.js'

test('Throttle capacity', (t) => {
  const throttle = new Throttle(1000, 100)

  throttle.currentBytes = 0
  t.deepEqual(throttle.computeCapacity(), { consumed: 0, carryover: 0 })

  throttle.currentBytes = 500
  t.deepEqual(throttle.computeCapacity(), { consumed: 500, carryover: 0 })

  throttle.currentBytes = 1000
  t.deepEqual(throttle.computeCapacity(), { consumed: 1000, carryover: 0 })

  throttle.currentBytes = 1500
  t.deepEqual(throttle.computeCapacity(), { consumed: 1000, carryover: 500 })
})

test('ThrottlingTransform', async (t) => {
  const chunkSize = 1024 // 1kb
  const chunks = 10 // 10 kb
  const streams = 10 // total 100kb

  class EmitterMock extends Readable {
    _read() {
      const chunk = Buffer.from('a'.repeat(chunkSize))
      for (let i = 0; i < chunks; i++) {
        this.push(chunk)
      }
      this.push(null)
    }
  }

  class ReceiverMock extends Writable {
    buffers: Buffer[] = []
    _write(chunk: Buffer | null, _: string, done: (error?: Error | null) => void): void {
      if (chunk) this.buffers.push(chunk)
      done()
    }
  }

  const mbps = (chunkSize * chunks * streams * 8) / 1024 / 1024 // 100 KB/s
  const throttlingPool = Throttle.fromMbps(mbps, 100)
  throttlingPool.start()

  const startedMs = Date.now()
  const emitters = [...Array(streams)].map(() => new EmitterMock())

  const receivers = emitters.map((emitter) => {
    const throttling = new ThrottlingTransform(throttlingPool, 10)
    const receiver = new ReceiverMock()
    emitter.pipe(throttling).pipe(receiver)
    return receiver
  })

  await Promise.all(receivers.map((receiver) => new Promise((resolve) => receiver.on('finish', resolve))))
  const finishedMs = Date.now()

  const durationMs = finishedMs - startedMs
  t.true(durationMs >= 900, '100 KB should take more than 900 second (1000ms but last 100ms is no wait)')

  throttlingPool.stop()

  const unitMs = 100
  const report = throttlingPool.simpleReport(100)
  const limit = (mbps * 1024 * 1024 * unitMs) / 1000
  t.true(report.maxBytesPerUnit <= limit * 1.1, 'maxBytesPerUnit should be less than almost mbps')

  for (const receiver of receivers) {
    const concat = Buffer.concat(receiver.buffers)
    t.is(concat.length, chunkSize * chunks, 'receiver should receive all chunks')
  }
})
