const isDebugEnabled = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true'

type LogFn = (...args: unknown[]) => void

const createLog =
  (method: 'debug' | 'info' | 'warn' | 'error'): LogFn =>
  (...args) => {
    if (!isDebugEnabled) return
    console[method](...args)
  }

export const logger = {
  debug: createLog('debug'),
  info: createLog('info'),
  warn: createLog('warn'),
  error: createLog('error'),
}
