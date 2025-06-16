import { EXTENSION_ID, LOG_LEVEL } from '@vscode-wdio/constants'
import * as vscode from 'vscode'

import { FileLogger } from './fileLogger.js'
import type { ILogger, WdioLogLevel } from '@vscode-wdio/types'

export const LOG_LEVEL_NAMES: Record<LOG_LEVEL, string> = {
    [LOG_LEVEL.TRACE]: 'TRACE',
    [LOG_LEVEL.DEBUG]: 'DEBUG',
    [LOG_LEVEL.INFO]: 'INFO',
    [LOG_LEVEL.WARN]: 'WARN',
    [LOG_LEVEL.ERROR]: 'ERROR',
    [LOG_LEVEL.SILENT]: 'SILENT ',
} as const

export class VscodeWdioLogger implements ILogger, vscode.Disposable {
    private _timezoneString: string | undefined
    private _disposables: vscode.Disposable[] = []
    private _logLevel: LOG_LEVEL
    private _fileLogger: FileLogger | undefined

    constructor(
        logLevel?: WdioLogLevel,
        private _outputChannel = vscode.window.createOutputChannel('WebdriverIO')
    ) {
        this._logLevel = this.updateLogLevel(logLevel)

        if (process.env.VSCODE_WDIO_TRACE_LOG_PATH) {
            try {
                this._fileLogger = new FileLogger(process.env.VSCODE_WDIO_TRACE_LOG_PATH)
                this._disposables.push(this._fileLogger)
            } catch (error) {
                this.error(error instanceof Error ? error.message : String(error))
            }
        }

        _outputChannel.show(true)
        this._disposables.push(_outputChannel)

        const watcher = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('webdriverio.logLevel')) {
                this._logLevel = this.updateLogLevel()
            }
        })
        this._disposables.push(watcher)
    }

    private updateLogLevel(logLevel?: WdioLogLevel) {
        const isDebug = Boolean(process.env.VSCODE_WDIO_DEBUG)
        const newValue = isDebug
            ? 'trace'
            : logLevel
                ? logLevel
                : vscode.workspace.getConfiguration(EXTENSION_ID).get<WdioLogLevel>('logLevel')

        switch (!newValue ? 'info' : newValue.toLowerCase()) {
            case 'trace':
                return LOG_LEVEL.TRACE
            case 'debug':
                return LOG_LEVEL.DEBUG
            case 'info':
                return LOG_LEVEL.INFO
            case 'warn':
                return LOG_LEVEL.WARN
            case 'error':
                return LOG_LEVEL.ERROR
            case 'none':
                return LOG_LEVEL.SILENT
            default:
                return LOG_LEVEL.INFO
        }
    }

    private log(level: LOG_LEVEL, message: unknown): void {
        const timestamp = `[${this.getDateTime()}]`
        const serializedMsg = typeof message !== 'string' ? JSON.stringify(message) : message
        const levelText = `[${LOG_LEVEL_NAMES[level]}] `.substring(0, 7)
        const logMessage = `${timestamp} ${levelText} ${serializedMsg}`

        if (level >= this._logLevel) {
            this._outputChannel.appendLine(logMessage)
        }

        if (this._fileLogger) {
            try {
                this._fileLogger.write(logMessage)
            } catch (error) {
                this._fileLogger = undefined
                this.error(error instanceof Error ? error.message : String(error))
            }
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

    private getDateTime() {
        const now = new Date()
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const day = String(now.getDate()).padStart(2, '0')
        const hours = String(now.getHours()).padStart(2, '0')
        const minutes = String(now.getMinutes()).padStart(2, '0')
        const seconds = String(now.getSeconds()).padStart(2, '0')

        if (!this._timezoneString) {
            this.calculateTimezone(now.getTimezoneOffset())
        }

        return `${month}-${day} ${hours}:${minutes}:${seconds}${this._timezoneString}`
    }

    private calculateTimezone(offsetMinutes: number) {
        const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60) // Units are in ‘minutes’, offset from UTC
        const offsetMins = Math.abs(offsetMinutes) % 60
        const sign = offsetMinutes <= 0 ? '+' : '-'

        this._timezoneString = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`
    }

    dispose() {
        for (const disposable of this._disposables) {
            disposable.dispose()
        }
    }
}
