import type { LOG_LEVEL } from '@vscode-wdio/constants'
export type { WebdriverIOConfig } from '@vscode-wdio/constants'

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
