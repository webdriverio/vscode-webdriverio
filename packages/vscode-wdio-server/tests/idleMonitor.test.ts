import { log } from '@vscode-wdio/logger'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'

import { WorkerIdleMonitor } from '../src/idleMonitor.js'

// Mock the logger module
vi.mock('@vscode-wdio/logger', () => ({
    log: {
        debug: vi.fn(),
        trace: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

describe('WorkerIdleMonitor', () => {
    let monitor: WorkerIdleMonitor
    let mockLoggerDebug: ReturnType<typeof vi.fn>
    let mockLoggerTrace: ReturnType<typeof vi.fn>
    let mockLoggerInfo: ReturnType<typeof vi.fn>

    beforeEach(() => {
        // Reset all mocks before each test
        vi.clearAllMocks()
        vi.useFakeTimers()

        // Get references to mocked logger functions
        mockLoggerDebug = vi.mocked(log.debug)
        mockLoggerTrace = vi.mocked(log.trace)
        mockLoggerInfo = vi.mocked(log.info)
    })

    afterEach(() => {
        // Clean up after each test
        if (monitor) {
            monitor.stop()
        }
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    describe('Constructor', () => {
        it('should create monitor with valid timeout', () => {
            // Arrange & Act
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 300 })

            // Assert
            expect(monitor.isActive()).toBe(false)
            expect(mockLoggerDebug).toHaveBeenCalledWith('[test-worker] IdleMonitor created with timeout: 300000ms')
        })

        it('should create monitor with disabled timeout when timeout is 0', () => {
            // Arrange & Act
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 0 })

            // Assert
            expect(monitor.isActive()).toBe(false)
            expect(mockLoggerDebug).toHaveBeenCalledWith('[test-worker] IdleMonitor created with timeout disabled')
        })

        it('should create monitor with disabled timeout when timeout is negative', () => {
            // Arrange & Act
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: -10 })

            // Assert
            expect(monitor.isActive()).toBe(false)
            expect(mockLoggerDebug).toHaveBeenCalledWith('[test-worker] IdleMonitor created with timeout disabled')
        })
    })

    describe('start()', () => {
        beforeEach(() => {
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 5 })
        })

        it('should start monitoring and set active state', () => {
            // Arrange & Act
            monitor.start()

            // Assert
            expect(monitor.isActive()).toBe(true)
            expect(mockLoggerDebug).toHaveBeenCalledWith('[test-worker] IdleMonitor started')
        })

        it('should not start monitoring if already active', () => {
            // Arrange
            monitor.start()
            vi.clearAllMocks()

            // Act
            monitor.start()

            // Assert
            expect(mockLoggerDebug).toHaveBeenCalledWith('[test-worker] IdleMonitor already active')
        })

        it('should start timer when timeout is enabled', () => {
            // Arrange
            const timeoutSpy = vi.spyOn(global, 'setTimeout')

            // Act
            monitor.start()

            // Assert
            expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000)
        })

        it('should not start timer when timeout is disabled', () => {
            // Arrange
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 0 })
            const timeoutSpy = vi.spyOn(global, 'setTimeout')

            // Act
            monitor.start()

            // Assert
            expect(timeoutSpy).not.toHaveBeenCalled()
        })
    })

    describe('stop()', () => {
        beforeEach(() => {
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 5 })
        })

        it('should stop monitoring and clear timer', () => {
            // Arrange
            monitor.start()
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

            // Act
            monitor.stop()

            // Assert
            expect(monitor.isActive()).toBe(false)
            expect(clearTimeoutSpy).toHaveBeenCalled()
            expect(mockLoggerDebug).toHaveBeenCalledWith('[test-worker] IdleMonitor stopped')
        })

        it('should not do anything if already stopped', () => {
            // Arrange
            vi.clearAllMocks()

            // Act
            monitor.stop()

            // Assert
            expect(mockLoggerDebug).not.toHaveBeenCalled()
        })

        it('should reset pause counter when stopped', () => {
            // Arrange
            monitor.start()
            monitor.pauseTimer()
            monitor.pauseTimer() // Multiple pauses

            // Act
            monitor.stop()

            // Assert - Should be able to resume properly after restart
            monitor.start()
            monitor.pauseTimer()
            monitor.resumeTimer()
            expect(mockLoggerTrace).toHaveBeenCalledWith('[test-worker] IdleMonitor timer resumed')
        })
    })

    describe('resetTimer()', () => {
        beforeEach(() => {
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 5 })
        })

        it('should reset timer when active and not paused', () => {
            // Arrange
            monitor.start()
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
            vi.clearAllMocks()

            // Act
            monitor.resetTimer()

            // Assert
            expect(clearTimeoutSpy).toHaveBeenCalled()
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000)
            expect(mockLoggerTrace).toHaveBeenCalledWith('[test-worker] IdleMonitor timer reset')
        })

        it('should not reset timer when not active', () => {
            // Arrange
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

            // Act
            monitor.resetTimer()

            // Assert
            expect(setTimeoutSpy).not.toHaveBeenCalled()
            expect(mockLoggerTrace).not.toHaveBeenCalled()
        })

        it('should not reset timer when paused', () => {
            // Arrange
            monitor.start()
            monitor.pauseTimer()
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
            vi.clearAllMocks()

            // Act
            monitor.resetTimer()

            // Assert
            expect(setTimeoutSpy).not.toHaveBeenCalled()
            expect(mockLoggerTrace).not.toHaveBeenCalled()
        })

        it('should not reset timer when timeout is disabled', () => {
            // Arrange
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 0 })
            monitor.start()
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

            // Act
            monitor.resetTimer()

            // Assert
            expect(setTimeoutSpy).not.toHaveBeenCalled()
            expect(mockLoggerTrace).not.toHaveBeenCalled()
        })
    })

    describe('pauseTimer()', () => {
        beforeEach(() => {
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 5 })
        })

        it('should pause timer and increment pause counter', () => {
            // Arrange
            monitor.start()
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
            vi.clearAllMocks()

            // Act
            monitor.pauseTimer()

            // Assert
            expect(clearTimeoutSpy).toHaveBeenCalled()
            expect(mockLoggerTrace).toHaveBeenCalledWith('[test-worker] IdleMonitor timer paused')
        })

        it('should handle multiple pauses correctly', () => {
            // Arrange
            monitor.start()
            vi.clearAllMocks()

            // Act
            monitor.pauseTimer()
            monitor.pauseTimer()
            monitor.pauseTimer()

            // Assert
            expect(mockLoggerTrace).toHaveBeenCalledTimes(3)
        })

        it('should not pause when not active', () => {
            // Arrange
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

            // Act
            monitor.pauseTimer()

            // Assert
            expect(clearTimeoutSpy).not.toHaveBeenCalled()
            expect(mockLoggerTrace).not.toHaveBeenCalled()
        })

        it('should not pause when timeout is disabled', () => {
            // Arrange
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 0 })
            monitor.start()
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

            // Act
            monitor.pauseTimer()

            // Assert
            expect(clearTimeoutSpy).not.toHaveBeenCalled()
            expect(mockLoggerTrace).not.toHaveBeenCalled()
        })
    })

    describe('resumeTimer()', () => {
        beforeEach(() => {
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 5 })
        })

        it('should resume timer after single pause', () => {
            // Arrange
            monitor.start()
            monitor.pauseTimer()
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
            vi.clearAllMocks()

            // Act
            monitor.resumeTimer()

            // Assert
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000)
            expect(mockLoggerTrace).toHaveBeenCalledWith('[test-worker] IdleMonitor timer resumed')
        })

        it('should handle multiple pause/resume correctly', () => {
            // Arrange
            monitor.start()
            monitor.pauseTimer()
            monitor.pauseTimer()
            monitor.pauseTimer()
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
            vi.clearAllMocks()

            // Act - First two resumes should not start timer
            monitor.resumeTimer()
            monitor.resumeTimer()
            expect(setTimeoutSpy).not.toHaveBeenCalled()
            expect(mockLoggerTrace).not.toHaveBeenCalled()

            // Third resume should start timer
            monitor.resumeTimer()

            // Assert
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000)
            expect(mockLoggerTrace).toHaveBeenCalledWith('[test-worker] IdleMonitor timer resumed')
        })

        it('should not resume when not active', () => {
            // Arrange
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

            // Act
            monitor.resumeTimer()

            // Assert
            expect(setTimeoutSpy).not.toHaveBeenCalled()
            expect(mockLoggerTrace).not.toHaveBeenCalled()
        })

        it('should not resume when timeout is disabled', () => {
            // Arrange
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 0 })
            monitor.start()
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

            // Act
            monitor.resumeTimer()

            // Assert
            expect(setTimeoutSpy).not.toHaveBeenCalled()
            expect(mockLoggerTrace).not.toHaveBeenCalled()
        })
    })

    describe('updateTimeout()', () => {
        beforeEach(() => {
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 5 })
        })

        it('should update timeout to new value', () => {
            // Arrange
            monitor.start()
            vi.clearAllMocks()

            // Act
            monitor.updateTimeout(10)

            // Assert
            expect(mockLoggerDebug).toHaveBeenCalledWith('[test-worker] IdleMonitor timeout updated: 5000ms -> 10ms')
        })

        it('should disable timeout when set to 0', () => {
            // Arrange
            monitor.start()
            vi.clearAllMocks()

            // Act
            monitor.updateTimeout(0)

            // Assert
            expect(mockLoggerDebug).toHaveBeenCalledWith('[test-worker] IdleMonitor updated with timeout disabled')
        })

        it('should disable timeout when set to negative value', () => {
            // Arrange
            monitor.start()
            vi.clearAllMocks()

            // Act
            monitor.updateTimeout(-5)

            // Assert
            expect(mockLoggerDebug).toHaveBeenCalledWith('[test-worker] IdleMonitor updated with timeout disabled')
        })

        it('should not update when same timeout value', () => {
            // Arrange
            monitor.start()
            vi.clearAllMocks()

            // Act
            monitor.updateTimeout(5)

            // Assert
            expect(mockLoggerDebug).not.toHaveBeenCalled()
        })

        it('should reset timer when active and timeout changes', () => {
            // Arrange
            monitor.start()
            const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
            vi.clearAllMocks()

            // Act
            monitor.updateTimeout(10)

            // Assert
            expect(clearTimeoutSpy).toHaveBeenCalled()
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000)
        })
    })

    describe('Timeout behavior', () => {
        beforeEach(() => {
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 5 })
        })

        it('should emit idleTimeout event when timer expires', () => {
            // Arrange
            monitor.start()
            const idleTimeoutHandler = vi.fn()
            monitor.on('idleTimeout', idleTimeoutHandler)

            // Act
            vi.advanceTimersByTime(5000)

            // Assert
            expect(idleTimeoutHandler).toHaveBeenCalledTimes(1)
            expect(mockLoggerInfo).toHaveBeenCalledWith('[test-worker] Worker idle timeout triggered')
        })

        it('should stop monitoring after timeout event', () => {
            // Arrange
            monitor.start()
            const idleTimeoutHandler = vi.fn()
            monitor.on('idleTimeout', idleTimeoutHandler)

            // Act
            vi.advanceTimersByTime(5000)

            // Assert
            expect(monitor.isActive()).toBe(false)
        })

        it('should not timeout when paused', () => {
            // Arrange
            monitor.start()
            monitor.pauseTimer()
            const idleTimeoutHandler = vi.fn()
            monitor.on('idleTimeout', idleTimeoutHandler)

            // Act
            vi.advanceTimersByTime(10000)

            // Assert
            expect(idleTimeoutHandler).not.toHaveBeenCalled()
        })

        it('should timeout after resuming from pause', () => {
            // Arrange
            monitor.start()
            monitor.pauseTimer()
            const idleTimeoutHandler = vi.fn()
            monitor.on('idleTimeout', idleTimeoutHandler)

            // Act
            vi.advanceTimersByTime(3000) // Should not timeout while paused
            monitor.resumeTimer()
            vi.advanceTimersByTime(5000) // Should timeout after resume

            // Assert
            expect(idleTimeoutHandler).toHaveBeenCalledTimes(1)
        })

        it('should not timeout when timeout is disabled', () => {
            // Arrange
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 0 })
            monitor.start()
            const idleTimeoutHandler = vi.fn()
            monitor.on('idleTimeout', idleTimeoutHandler)

            // Act
            vi.advanceTimersByTime(100000)

            // Assert
            expect(idleTimeoutHandler).not.toHaveBeenCalled()
        })
    })

    describe('Edge cases', () => {
        it('should handle rapid start/stop cycles', () => {
            // Arrange
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 5 })

            // Act & Assert - Should not throw errors
            expect(() => {
                monitor.start()
                monitor.stop()
                monitor.start()
                monitor.stop()
                monitor.start()
            }).not.toThrow()
        })

        it('should handle rapid pause/resume cycles', () => {
            // Arrange
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 5 })
            monitor.start()

            // Act & Assert - Should not throw errors
            expect(() => {
                monitor.pauseTimer()
                monitor.resumeTimer()
                monitor.pauseTimer()
                monitor.pauseTimer()
                monitor.resumeTimer()
                monitor.resumeTimer()
            }).not.toThrow()
        })

        it('should handle excessive resume calls gracefully', () => {
            // Arrange
            const setTimeoutSpy = vi.spyOn(global, 'setTimeout')
            monitor = new WorkerIdleMonitor('test-worker', { idleTimeout: 5 })
            monitor.start()

            // Act
            monitor.resumeTimer() // Resume without pause
            monitor.resumeTimer() // Resume again
            monitor.resumeTimer() // Resume again

            // Assert - Should only start timer once
            expect(setTimeoutSpy).toHaveBeenCalledTimes(1)
        })
    })
})
