import { LOG_LEVEL } from '@vscode-wdio/constants'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

import { FileLogger } from '../src/fileLogger.js'
import { VscodeWdioLogger } from '../src/logger.js'

// Mock vscode module
vi.mock('vscode', async () => import('../../../tests/__mocks__/vscode.cjs'))

vi.mock('../src/fileLogger.js', () => {
    const FileLogger = vi.fn()
    FileLogger.prototype.write = vi.fn().mockResolvedValue(undefined)
    FileLogger.prototype.dispose = vi.fn().mockResolvedValue(undefined)
    return { FileLogger }
})

describe('VscodeWdioLogger', () => {
    let mockOutputChannel: vscode.LogOutputChannel
    let mockDate: Date

    beforeEach(() => {
        mockOutputChannel = {
            show: vi.fn(),
            appendLine: vi.fn(),
            dispose: vi.fn(),
        } as unknown as vscode.LogOutputChannel

        vi.mocked(vscode.window.createOutputChannel).mockReturnValue(mockOutputChannel)

        // Mock configuration
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
            get: vi.fn(),
        } as any)

        // Mock Date for consistent timestamp testing
        mockDate = new Date('2024-01-01T12:00:00')
        vi.spyOn(Date, 'now').mockReturnValue(mockDate.getTime())
        vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(0) // January
        vi.spyOn(Date.prototype, 'getDate').mockReturnValue(1)
        vi.spyOn(Date.prototype, 'getHours').mockReturnValue(12)
        vi.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0)
        vi.spyOn(Date.prototype, 'getSeconds').mockReturnValue(0)
        vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-540) // UTC+9
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('constructor', () => {
        it('should create output channel and show it', () => {
            new VscodeWdioLogger()

            expect(vscode.window.createOutputChannel).toHaveBeenCalledWith('WebdriverIO')
            expect(mockOutputChannel.show).toHaveBeenCalledWith(true)
        })

        it('should initialize the FileLogger when env is set', () => {
            const dummyPath = process.platform === 'win32' ? 'c:\\path\\to\\log' : '/path/to/log'
            process.env.VSCODE_WDIO_TRACE_LOG_PATH = dummyPath
            new VscodeWdioLogger()

            expect(FileLogger).toHaveBeenCalledWith(dummyPath)
            delete process.env.VSCODE_WDIO_TRACE_LOG_PATH
        })

        it('should undefined when failed to initialize the FileLogger', () => {
            const dummyPath = process.platform === 'win32' ? 'c:\\path\\to\\log' : '/path/to/log'
            process.env.VSCODE_WDIO_TRACE_LOG_PATH = dummyPath
            vi.mocked(FileLogger).mockImplementation(() => {
                throw new Error()
            })
            const logger = new VscodeWdioLogger()

            expect((logger as any)._logFilePath).toBeUndefined()
            delete process.env.VSCODE_WDIO_TRACE_LOG_PATH
        })
    })

    it('should use info log level as default value', () => {
        const logger = new VscodeWdioLogger()

        // Trace message should be logged
        logger.trace('trace')
        logger.info('info')

        expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(1)
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('info'))
    })

    it('should use trace log level when DEBUG_ACTIVE is true', () => {
        // Setup
        const originalEnv = process.env.VSCODE_WDIO_DEBUG
        process.env.VSCODE_WDIO_DEBUG = 'true'

        const logger = new VscodeWdioLogger('info')

        // Trace message should be logged
        logger.trace('test message')
        expect(mockOutputChannel.appendLine).toHaveBeenCalled()

        // Restore original process.env
        if (originalEnv === undefined) {
            delete process.env.VSCODE_WDIO_DEBUG
        } else {
            process.env.VSCODE_WDIO_DEBUG = originalEnv
        }
    })

    describe('updateLogLevel', () => {
        it('should set log level to INFO by default', () => {
            // Mock configuration to return undefined log level
            vi.mocked(vscode.workspace.getConfiguration().get).mockReturnValue(undefined)

            const logger = new VscodeWdioLogger()

            // Test by checking if INFO messages are logged
            logger.info('test message')
            expect(mockOutputChannel.appendLine).toHaveBeenCalled()
        })

        it('should set log level from configuration', () => {
            // Set DEBUG log level in configuration
            vi.mocked(vscode.workspace.getConfiguration().get).mockReturnValue('debug')

            const logger = new VscodeWdioLogger()

            // DEBUG should be logged when level is DEBUG
            logger.debug('test message')
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('DEBUG'))

            // TRACE should not be logged
            logger.trace('test trace')
            expect(mockOutputChannel.appendLine).not.toHaveBeenCalledWith(expect.stringContaining('TRACE'))
        })

        it('should handle all log level values', () => {
            const testLogLevels = [
                { config: 'trace', expected: LOG_LEVEL.TRACE },
                { config: 'debug', expected: LOG_LEVEL.DEBUG },
                { config: 'info', expected: LOG_LEVEL.INFO },
                { config: 'warn', expected: LOG_LEVEL.WARN },
                { config: 'error', expected: LOG_LEVEL.ERROR },
                { config: 'none', expected: LOG_LEVEL.SILENT },
                { config: 'unknown', expected: LOG_LEVEL.INFO },
            ]

            testLogLevels.forEach((test) => {
                vi.mocked(vscode.workspace.getConfiguration().get).mockReturnValue(test.config)
                const logger = new VscodeWdioLogger()

                // Access private property for testing
                const logLevel = (logger as any)._logLevel
                expect(logLevel).toBe(test.expected)
            })
        })
    })

    describe('log methods', () => {
        beforeEach(() => {
            vi.mocked(vscode.workspace.getConfiguration().get).mockReturnValue('trace') // Set to lowest level to test all methods
        })

        it('should format log messages correctly', () => {
            const dummyPath = process.platform === 'win32' ? 'c:\\path\\to\\log' : '/path/to/log'
            process.env.VSCODE_WDIO_TRACE_LOG_PATH = dummyPath

            const logger = new VscodeWdioLogger()
            logger.info('test message')

            const fileLogger = vi.mocked(FileLogger).mock.instances[0]

            // Expected format: [MM-DD HH:MM:SS+TZ] [LEVEL] message
            const expectedLogMessage = '[01-01 12:00:00+09:00] [INFO]  test message'
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining(expectedLogMessage))
            expect(fileLogger.write).toHaveBeenCalledWith(expect.stringContaining(expectedLogMessage))

            delete process.env.VSCODE_WDIO_TRACE_LOG_PATH
        })

        it('should not write to file once error occurred', () => {
            const dummyPath = process.platform === 'win32' ? 'c:\\path\\to\\log' : '/path/to/log'
            process.env.VSCODE_WDIO_TRACE_LOG_PATH = dummyPath

            vi.mocked(FileLogger.prototype.write).mockImplementation(() => {
                throw new Error('DUMMY ERROR')
            })
            const logger = new VscodeWdioLogger()
            logger.info('test message')

            const fileLogger = vi.mocked(FileLogger).mock.instances[0]
            expect(fileLogger.write).toHaveBeenCalledTimes(1)

            delete process.env.VSCODE_WDIO_TRACE_LOG_PATH
        })

        it('should stringify non-string messages', () => {
            const logger = new VscodeWdioLogger()
            const obj = { test: 'value' }
            logger.info(obj)

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('[01-01 12:00:00+09:00] [INFO]  {"test":"value"}')
            )
        })

        it('should respect log level threshold', () => {
            // Set to WARN level
            vi.mocked(vscode.workspace.getConfiguration().get).mockReturnValue('warn')
            const logger = new VscodeWdioLogger()

            // These should not log
            logger.trace('test message')
            logger.debug('test message')
            logger.info('test message')
            expect(mockOutputChannel.appendLine).not.toHaveBeenCalled()

            // These should log
            logger.warn('test message')
            expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(1)

            logger.error('test message')
            expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(2)
        })

        it('should call log with correct log level for each method', () => {
            const logger = new VscodeWdioLogger()
            const logSpy = vi.spyOn(logger as any, 'log')

            logger.trace('trace message')
            expect(logSpy).toHaveBeenCalledWith(LOG_LEVEL.TRACE, 'trace message')

            logger.debug('debug message')
            expect(logSpy).toHaveBeenCalledWith(LOG_LEVEL.DEBUG, 'debug message')

            logger.info('info message')
            expect(logSpy).toHaveBeenCalledWith(LOG_LEVEL.INFO, 'info message')

            logger.warn('warn message')
            expect(logSpy).toHaveBeenCalledWith(LOG_LEVEL.WARN, 'warn message')

            logger.error('error message')
            expect(logSpy).toHaveBeenCalledWith(LOG_LEVEL.ERROR, 'error message')
        })
    })

    describe('time formatting', () => {
        it('should format date and time correctly', () => {
            vi.mocked(vscode.workspace.getConfiguration().get).mockReturnValue('info')
            const logger = new VscodeWdioLogger()
            logger.info('test message')

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/\[01-01 12:00:00\+09:00\]/)
            )
        })

        it('should calculate timezone string correctly for positive offset', () => {
            // Reset mocks to test a different timezone
            vi.restoreAllMocks()

            // Setup new mocks for this test
            mockOutputChannel = {
                appendLine: vi.fn(),
                show: vi.fn(),
                dispose: vi.fn(),
                replace: vi.fn(),
                clear: vi.fn(),
                hide: vi.fn(),
                name: 'WebdriverIO',
                onDidChangeVisibility: vi.fn(),
            } as unknown as vscode.LogOutputChannel

            vi.mocked(vscode.window.createOutputChannel).mockReturnValue(mockOutputChannel)
            vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
                get: vi.fn().mockReturnValue('info'),
            } as any)

            // Mock date for west coast timezone (UTC-8)
            vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(0)
            vi.spyOn(Date.prototype, 'getDate').mockReturnValue(1)
            vi.spyOn(Date.prototype, 'getHours').mockReturnValue(12)
            vi.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0)
            vi.spyOn(Date.prototype, 'getSeconds').mockReturnValue(0)
            vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(480) // UTC-8 (positive offset)

            const logger = new VscodeWdioLogger()
            logger.info('test message')

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringMatching(/\[01-01 12:00:00-08:00\]/))
        })

        it('should handle minutes in timezone offset', () => {
            // Reset mocks to test an unusual timezone
            vi.restoreAllMocks()

            // Setup new mocks for this test
            mockOutputChannel = {
                appendLine: vi.fn(),
                show: vi.fn(),
                dispose: vi.fn(),
                replace: vi.fn(),
                clear: vi.fn(),
                hide: vi.fn(),
                name: 'WebdriverIO',
                onDidChangeVisibility: vi.fn(),
            } as unknown as vscode.LogOutputChannel

            vi.mocked(vscode.window.createOutputChannel).mockReturnValue(mockOutputChannel)
            vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
                get: vi.fn().mockReturnValue('info'),
            } as any)

            // Mock date for a timezone with minutes offset (UTC+5:30)
            vi.spyOn(Date.prototype, 'getMonth').mockReturnValue(0)
            vi.spyOn(Date.prototype, 'getDate').mockReturnValue(1)
            vi.spyOn(Date.prototype, 'getHours').mockReturnValue(12)
            vi.spyOn(Date.prototype, 'getMinutes').mockReturnValue(0)
            vi.spyOn(Date.prototype, 'getSeconds').mockReturnValue(0)
            vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-330) // UTC+5:30 (negative offset with minutes)

            const logger = new VscodeWdioLogger()
            logger.info('test message')

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringMatching(/\[01-01 12:00:00\+05:30\]/)
            )
        })
    })

    describe('dispose', () => {
        it('should dispose the fileLogger', () => {
            const dummyPath = process.platform === 'win32' ? 'c:\\path\\to\\log' : '/path/to/log'
            process.env.VSCODE_WDIO_TRACE_LOG_PATH = dummyPath

            const mockWatcher = { dispose: vi.fn() }
            vi.mocked(vscode.workspace.onDidChangeConfiguration).mockReturnValue(mockWatcher)

            const logger = new VscodeWdioLogger()
            const fileLogger = vi.mocked(FileLogger).mock.instances[0]

            // Act
            logger.dispose()

            // Assertion
            expect(fileLogger.dispose).toHaveBeenCalled()
            expect(mockOutputChannel.dispose).toHaveBeenCalled()
            expect(mockWatcher.dispose).toHaveBeenCalled()

            delete process.env.VSCODE_WDIO_TRACE_LOG_PATH
        })
    })
})
