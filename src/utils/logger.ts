import * as vscode from 'vscode'

import { EXTENSION_ID, LOG_LEVEL } from '../constants.js'
import type { LoggerInterface, WdioLogLevel } from '../types.js'

export const LOG_LEVEL_NAMES: Record<LOG_LEVEL, string> = {
    [LOG_LEVEL.TRACE]: 'TRACE',
    [LOG_LEVEL.DEBUG]: 'DEBUG',
    [LOG_LEVEL.INFO]: 'INFO',
    [LOG_LEVEL.WARN]: 'WARN',
    [LOG_LEVEL.ERROR]: 'ERROR',
    [LOG_LEVEL.SILENT]: 'SILENT ',
} as const

export class VscodeWdioLogger implements LoggerInterface {
    private _timezoneString: string | undefined
    private _disposables: vscode.Disposable[] = []

    constructor(
        private _logLevel: LOG_LEVEL = this.updateLogLevel(),
        private _outputChannel = this.createOutputChannel()
    ) {
        const watcher = vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('webdriverio.logLevel')) {
                this._logLevel = this.updateLogLevel()
            }
        })
        this._disposables.push(watcher)
    }

    private updateLogLevel(): LOG_LEVEL {
        const isDebug = Boolean(process.env.VSCODE_WDIO_DEBUG)
        const config = vscode.workspace.getConfiguration(EXTENSION_ID)
        const newValue = isDebug ? 'trace' : config.get<WdioLogLevel>('logLevel')

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

    private createOutputChannel() {
        const channel = vscode.window.createOutputChannel('WebdriverIO')
        channel.show(true)
        this._disposables.push(channel)
        return channel
    }

    private log(level: LOG_LEVEL, message: unknown): void {
        if (level < this._logLevel) {
            return
        }

        const timestamp = `[${this.getDateTime()}]`
        const serializedMsg = typeof message !== 'string' ? JSON.stringify(message) : message
        const levelText = `[${LOG_LEVEL_NAMES[level]}] `.substring(0, 7)
        const logMessage = `${timestamp} ${levelText} ${serializedMsg}`
        this._outputChannel.appendLine(logMessage)
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
}

export const log = new VscodeWdioLogger()
