import type { LOG_LEVEL } from './constants.js'

export interface WebDriverIOConfig {
    configFilePattern: string[]
    testFilePattern: string[]
    showOutput: boolean
    logLevel: string
}

export type WdioLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'

export interface LoggerInterface {
    trace(message: unknown): void
    debug(message: unknown): void
    info(message: unknown): void
    warn(message: unknown): void
    error(message: unknown): void
}

type ValueOf<T> = T[keyof T]

export type NumericLogLevel = ValueOf<typeof LOG_LEVEL>
