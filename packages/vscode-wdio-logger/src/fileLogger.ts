import * as fs from 'node:fs'
import * as path from 'node:path'

import type * as vscode from 'vscode'

const LOG_FILE_NAME = 'vscode-webdriverio.log'

export class FileLogger implements vscode.Disposable {
    private _writeStream: fs.WriteStream
    private _isDisposed = false
    private _isWritable = false

    constructor(logFilePath: string) {
        try {
            const absLogFilePath = path.normalize(
                path.isAbsolute(logFilePath)
                    ? path.join(logFilePath, LOG_FILE_NAME)
                    : path.join(process.cwd(), logFilePath, LOG_FILE_NAME)
            )

            // Ensure directory exists
            const logDir = path.dirname(absLogFilePath)
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true })
            }

            // Create write stream
            this._writeStream = fs.createWriteStream(absLogFilePath, {
                flags: 'a', // append mode
                encoding: 'utf8',
            })

            this._isWritable = true

            // Handle stream errors
            this._writeStream.on('error', () => {
                this.dispose()
                this._isWritable = false
            })
        } catch (error) {
            throw new Error(
                `Failed to initialize FileLogger: ${error instanceof Error ? error.message : String(error)}`
            )
        }
    }

    /**
     * Get writable status
     */
    public get isWritable(): boolean {
        return this._isWritable && !this._isDisposed
    }

    /**
     * Write log message to file
     * @param message - Log message to write
     */
    public write(message: string): void {
        if (!this.isWritable) {
            return
        }

        try {
            this._writeStream.write(`${message}\n`)
        } catch (error) {
            this._isWritable = false
            this.dispose()
            throw new Error(`Failed to write log: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * Dispose the file logger and close the write stream
     */
    public dispose(): void {
        if (this._isDisposed) {
            return
        }

        try {
            this._writeStream.end()
        } catch {
            // pass
        } finally {
            this._isDisposed = true
        }
    }
}
