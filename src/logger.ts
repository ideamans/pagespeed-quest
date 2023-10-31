import Pino from 'pino'

export const singleton = Pino({
  transport: {
    target: 'pino-pretty',
    options: {
      levelFirst: true,
      hideObject: Boolean(!process.env.LOG_OBJECTS),
    },
  },
  level: process.env.LOG_LEVEL || 'info',
})

export function logger() {
  return singleton
}
