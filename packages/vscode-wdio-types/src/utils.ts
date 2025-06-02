import type { LOG_LEVEL } from '@vscode-wdio/constants'
import type * as vscode from 'vscode'

export interface WebdriverIOConfig {
    nodeExecutable: string | undefined
    configFilePattern: string[]
    showOutput: boolean
    logLevel: string
}

export type WdioLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'

export interface LoggerInterface extends vscode.Disposable {
    trace(message: unknown): void
    debug(message: unknown): void
    info(message: unknown): void
    warn(message: unknown): void
    error(message: unknown): void
}

type ValueOf<T> = T[keyof T]

export type NumericLogLevel = ValueOf<typeof LOG_LEVEL>
