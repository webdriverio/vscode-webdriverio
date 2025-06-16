import EventEmitter from 'node:events'

import { log } from '@vscode-wdio/logger'

import type { WorkerIdleMonitorOptions, IWorkerIdleMonitor } from '@vscode-wdio/types/server'

/**
 * Monitor worker idle state and emit timeout events
 */
export class WorkerIdleMonitor extends EventEmitter implements IWorkerIdleMonitor {
    private _timer: NodeJS.Timeout | null = null
    private _isActive = false
    private _pauseCounter = 0
    private _idleTimeout: number
    private _isTimeoutDisabled = false
    private readonly _workerId: string

    constructor(workerId: string, options: WorkerIdleMonitorOptions) {
        super()
        this._workerId = workerId
        const timeoutSeconds = options.idleTimeout
        this._isTimeoutDisabled = timeoutSeconds <= 0
        this._idleTimeout = this._isTimeoutDisabled ? 0 : timeoutSeconds * 1000 // Convert seconds to milliseconds

        if (this._isTimeoutDisabled) {
            log.debug(`[${this._workerId}] IdleMonitor created with timeout disabled`)
        } else {
            log.debug(`[${this._workerId}] IdleMonitor created with timeout: ${this._idleTimeout}ms`)
        }
    }

    /**
     * Start monitoring for idle timeout
     */
    public start(): void {
        if (this._isActive) {
            log.debug(`[${this._workerId}] IdleMonitor already active`)
            return
        }

        this._isActive = true
        this.resetTimer()
        log.debug(`[${this._workerId}] IdleMonitor started`)
    }

    /**
     * Stop monitoring and clear any pending timeout
     */
    public stop(): void {
        if (!this._isActive) {
            return
        }

        this._isActive = false
        this._pauseCounter = 0
        this.clearTimer()
        log.debug(`[${this._workerId}] IdleMonitor stopped`)
    }

    /**
     * Reset the idle timer (called when worker is accessed)
     */
    public resetTimer(): void {
        if (!this._isActive || this._pauseCounter > 0 || this._isTimeoutDisabled) {
            return
        }

        this.clearTimer()
        this.startTimer()
        log.trace(`[${this._workerId}] IdleMonitor timer reset`)
    }

    /**
     * Pause the idle timer (called when RPC operation starts)
     */
    public pauseTimer(): void {
        if (!this._isActive || this._isTimeoutDisabled) {
            return
        }

        this._pauseCounter++
        this.clearTimer()
        log.trace(`[${this._workerId}] IdleMonitor timer paused`)
    }

    /**
     * Resume the idle timer (called when RPC operation completes)
     */
    public resumeTimer(): void {
        if (!this._isActive || this._isTimeoutDisabled) {
            return
        }

        this._pauseCounter--
        if (this._pauseCounter < 1) {
            this.startTimer()
            log.trace(`[${this._workerId}] IdleMonitor timer resumed`)
        }
    }

    /**
     * Update the idle timeout configuration
     * @param timeout New timeout value in milliseconds
     */
    public updateTimeout(timeout: number): void {
        const newTimeout = timeout * 1000
        if (newTimeout === this._idleTimeout) {
            return
        }

        const oldTimeout = this._idleTimeout
        const timeoutSeconds = timeout
        this._isTimeoutDisabled = timeoutSeconds <= 0
        this._idleTimeout = this._isTimeoutDisabled ? 0 : timeoutSeconds * 1000

        if (this._isTimeoutDisabled) {
            log.debug(`[${this._workerId}] IdleMonitor updated with timeout disabled`)
        } else {
            log.debug(`[${this._workerId}] IdleMonitor timeout updated: ${oldTimeout}ms -> ${timeout}ms`)
        }

        // Restart timer with new timeout if currently active
        if (this._isActive) {
            this.resetTimer()
        }
    }

    /**
     * Check if monitoring is currently active
     */
    public isActive(): boolean {
        return this._isActive
    }

    /**
     * Clear the current timer
     */
    private clearTimer(): void {
        if (this._timer) {
            clearTimeout(this._timer)
            this._timer = null
        }
    }

    /**
     * Start a new timer with current timeout value
     */
    private startTimer(): void {
        if (this._pauseCounter > 0 || this._isTimeoutDisabled) {
            return
        }

        this._timer = setTimeout(() => {
            log.debug(`[${this._workerId}] Worker idle timeout reached after ${this._idleTimeout}ms`)
            this.handleIdleTimeout()
        }, this._idleTimeout)
    }

    /**
     * Handle idle timeout event
     */
    private handleIdleTimeout(): void {
        // Stop monitoring first to prevent multiple timeout events
        this.stop()

        log.info(`[${this._workerId}] Worker idle timeout triggered`)

        // Emit idle timeout event
        this.emit('idleTimeout')
    }
}
