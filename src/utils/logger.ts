import * as vscode from 'vscode'
import type { WdioLogLevel } from '../types.js'

export enum LogLevel {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    SILENT = 5,
}
export const LOG_LEVEL_NAMES: Record<LogLevel, string> = {
    [LogLevel.TRACE]: 'TRACE',
    [LogLevel.DEBUG]: 'DEBUG',
    [LogLevel.INFO]: 'INFO',
    [LogLevel.WARN]: 'WARN',
    [LogLevel.ERROR]: 'ERROR',
    [LogLevel.SILENT]: 'SILENT ',
} as const

class VscodeWdioLogger {
    constructor(
        private logLevel: LogLevel = this.updateLogLevel(),
        private outputChannel = vscode.window.createOutputChannel('WebDriverIO')
    ) {
        this.outputChannel.show(true)
        this.outputChannel.appendLine('==== INIT ===')
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('webdriverio.logLevel')) {
                this.logLevel = this.updateLogLevel()
            }
        })
    }

    private updateLogLevel(): LogLevel {
        const config = vscode.workspace.getConfiguration('webdriverio')
        const newValue = config.get<WdioLogLevel>('logLevel') || 'info'
        switch (newValue.toLowerCase()) {
            case 'trace':
                return LogLevel.TRACE
            case 'debug':
                return LogLevel.DEBUG
            case 'info':
                return LogLevel.INFO
            case 'warn':
                return LogLevel.WARN
            case 'error':
                return LogLevel.ERROR
            case 'none':
                return LogLevel.SILENT
            default:
                return LogLevel.INFO
        }
    }

    private log(level: LogLevel, message: unknown): void {
        if (level < this.logLevel) {
            return
        }

        const timestamp = `[${getDateTime()}]`
        const serializedMsg = typeof message !== 'string' ? JSON.stringify(message) : message
        const levelText = `[${LOG_LEVEL_NAMES[level]}] `.substring(0, 7)
        const logMessage = `${timestamp} ${levelText} ${serializedMsg}`
        this.outputChannel.appendLine(logMessage)
    }

    public trace(message: unknown): void {
        this.log(LogLevel.TRACE, message)
    }

    public debug(message: unknown): void {
        this.log(LogLevel.DEBUG, message)
    }

    public info(message: unknown): void {
        this.log(LogLevel.INFO, message)
    }

    public warn(message: unknown): void {
        this.log(LogLevel.WARN, message)
    }

    public error(message: unknown): void {
        this.log(LogLevel.ERROR, message)
    }
}

function getDateTime() {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')

    const offsetMinutes = now.getTimezoneOffset() // 単位は「分」、UTCからのオフセット
    const offsetHours = Math.floor(Math.abs(offsetMinutes) / 60)
    const offsetMins = Math.abs(offsetMinutes) % 60
    const sign = offsetMinutes <= 0 ? '+' : '-'

    const offset = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMins).padStart(2, '0')}`

    return `${month}-${day} ${hours}:${minutes}:${seconds}${offset}`
}

export const log = new VscodeWdioLogger()
