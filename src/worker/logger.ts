import { LOG_LEVEL } from '../constants.js'
import type { ExtensionApi } from '../api/index.js'
import type { LoggerInterface, NumericLogLevel } from '../types.js'

const weakLoggers = new WeakMap<ExtensionApi, LoggerInterface>()

export function getLogger(client: ExtensionApi) {
    const logger = weakLoggers.get(client)
    if (logger) {
        return logger
    }
    class Logger implements LoggerInterface {
        constructor(private readonly _client: ExtensionApi) {}

        private log(loglevel: NumericLogLevel, message: unknown) {
            try {
                const _message = typeof message === 'string' ? message : JSON.stringify(message)
                client.log(loglevel, _message)
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error)
                console.log(msg)
            }
        }

        public trace(message: unknown): void {
            this.log(LOG_LEVEL.TRACE, message)
        }

        public debug(message: unknown): void {
            this.log(LOG_LEVEL.DEBUG, message)
        }

        public info(message: unknown): void {
            this.log(LOG_LEVEL.INFO, message)
        }

        public warn(message: unknown): void {
            this.log(LOG_LEVEL.WARN, message)
        }

        public error(message: unknown): void {
            this.log(LOG_LEVEL.ERROR, message)
        }
    }

    const newLogger = new Logger(client)
    weakLoggers.set(client, newLogger)
    return newLogger
}
