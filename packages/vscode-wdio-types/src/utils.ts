import type { EventEmitter } from 'node:events'
import type { LOG_LEVEL } from '@vscode-wdio/constants'

export type WdioLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'

export interface ILogger {
    trace(message: unknown): void
    debug(message: unknown): void
    info(message: unknown): void
    warn(message: unknown): void
    error(message: unknown): void
}

type ValueOf<T> = T[keyof T]

export type NumericLogLevel = ValueOf<typeof LOG_LEVEL>

export interface ITypedEventEmitter<Events extends Record<string | symbol, any>> extends EventEmitter {
    emit<K extends keyof Events>(event: K, data: Events[K]): boolean
    on<K extends keyof Events>(event: K, listener: (data: Events[K]) => void | Promise<void>): this
}
