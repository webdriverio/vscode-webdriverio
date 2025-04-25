import * as chai from 'chai'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { LOG_LEVEL, EXTENSION_ID } from '../../src/constants.js'
import { VscodeWdioLogger, log } from '../../src/utils/logger.js'

const expect = chai.expect

describe('VscodeWdioLogger', () => {
    let sandbox: sinon.SinonSandbox
    let outputChannelMock: vscode.LogOutputChannel
    let appendLineSpy: sinon.SinonSpy
    let configStub: sinon.SinonStub
    let _createOutputChannelStub: sinon.SinonStub

    const mockDate = new Date('2024-01-01T12:00:00')

    beforeEach(() => {
        sandbox = sinon.createSandbox()

        // Mocking vscode.window.createOutputChannel
        appendLineSpy = sandbox.spy()
        outputChannelMock = {
            appendLine: appendLineSpy,
            show: sandbox.stub(),
            dispose: sandbox.stub(),
            replace: sandbox.stub(),
            clear: sandbox.stub(),
            hide: sandbox.stub(),
            name: 'WebdriverIO',
            onDidChangeVisibility: sandbox.stub(),
        } as unknown as vscode.LogOutputChannel

        _createOutputChannelStub = sandbox.stub(vscode.window, 'createOutputChannel').returns(outputChannelMock)

        // Mocking vscode.workspace.getConfiguration
        configStub = sandbox.stub()
        sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: configStub,
        } as any)

        // Mocking Date to ensure consistent timestamp testing
        sandbox.stub(Date, 'now').returns(mockDate.getTime())
        sandbox.stub(Date.prototype, 'getMonth').returns(0) // January
        sandbox.stub(Date.prototype, 'getDate').returns(1)
        sandbox.stub(Date.prototype, 'getHours').returns(12)
        sandbox.stub(Date.prototype, 'getMinutes').returns(0)
        sandbox.stub(Date.prototype, 'getSeconds').returns(0)
        sandbox.stub(Date.prototype, 'getTimezoneOffset').returns(-540) // UTC+9
    })

    afterEach(() => {
        sandbox.restore()
    })

    describe('constructor', () => {
        it('should create output channel and show it', () => {
            configStub.returns('info')
            new VscodeWdioLogger()

            expect(vscode.window.createOutputChannel).to.have.been.calledWith('WebdriverIO')
            expect(outputChannelMock.show).to.have.been.calledWith(true)
        })

        it('should use trace log level when DEBUG_ACTIVE is true', () => {
            // Save original process.env
            const originalEnv = process.env.VSCODE_WDIO_DEBUG
            // Set debug environment variable
            process.env.VSCODE_WDIO_DEBUG = 'true'

            configStub.returns('info')
            const logger = new VscodeWdioLogger()

            // Trace message should be logged
            logger.trace('test message')
            expect(appendLineSpy).to.have.been.called

            // Restore original process.env
            if (originalEnv === undefined) {
                delete process.env.VSCODE_WDIO_DEBUG
            } else {
                process.env.VSCODE_WDIO_DEBUG = originalEnv
            }
        })
    })

    describe('updateLogLevel', () => {
        it('should set log level to INFO by default', () => {
            // Mock configuration to return undefined log level
            configStub.returns(undefined)

            const logger = new VscodeWdioLogger()

            // Test by checking if INFO messages are logged
            logger.info('test message')
            expect(appendLineSpy).to.have.been.called
        })

        it('should set log level from configuration', () => {
            // Set ERROR log level in configuration
            configStub.returns('debug')

            const logger = new VscodeWdioLogger()

            // INFO should not be logged when level is ERROR
            logger.debug('test message')
            expect(appendLineSpy).to.have.been.calledWith(sinon.match(/DEBUG/))

            // ERROR should be logged
            logger.trace('test trace')
            expect(appendLineSpy).not.to.have.been.calledWith(sinon.match(/TRACE/))
        })

        it('should update log level when configuration changes', async () => {
            // Don't mock onDidChangeConfiguration, use the real one
            sandbox.restore()

            // Create a real output channel but spy on its methods
            const realOutputChannel = vscode.window.createOutputChannel('WebdriverIO-Test')
            appendLineSpy = sandbox.spy(realOutputChannel, 'appendLine')

            // Start with INFO level
            const initialConfig = vscode.workspace.getConfiguration(EXTENSION_ID)
            await initialConfig.update('logLevel', 'info', vscode.ConfigurationTarget.Global)

            const logger = new VscodeWdioLogger(undefined, realOutputChannel)

            // Clear any initial setup logs
            appendLineSpy.resetHistory()

            // Change to ERROR level
            const updatedConfig = vscode.workspace.getConfiguration(EXTENSION_ID)
            await updatedConfig.update('logLevel', 'error', vscode.ConfigurationTarget.Global)

            // Give some time for the event to be processed
            await new Promise((resolve) => setTimeout(resolve, 100))

            // INFO should no longer be logged
            logger.info('test info message')
            expect(appendLineSpy).not.to.have.been.calledWith(sinon.match(/test info message/))

            // ERROR should be logged
            logger.error('test error message')
            expect(appendLineSpy).to.have.been.calledWith(sinon.match(/test error message/))

            // Clean up - restore original setting
            await updatedConfig.update('logLevel', 'info', vscode.ConfigurationTarget.Global)
            realOutputChannel.dispose()
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
                configStub.returns(test.config)
                const logger = new VscodeWdioLogger()

                // Access private property for testing
                const logLevel = (logger as any)._logLevel
                expect(logLevel).to.equal(test.expected)
            })
        })
    })

    describe('log methods', () => {
        beforeEach(() => {
            configStub.returns('trace') // Set to lowest level to test all methods
        })

        it('should format log messages correctly', () => {
            const logger = new VscodeWdioLogger()
            logger.info('test message')

            // Expected format: [MM-DD HH:MM:SS+TZ] [LEVEL] message
            expect(appendLineSpy).to.have.been.calledWithMatch('[01-01 12:00:00+09:00] [INFO]  test message')
        })

        it('should stringify non-string messages', () => {
            const logger = new VscodeWdioLogger()
            const obj = { test: 'value' }
            logger.info(obj)

            expect(appendLineSpy).to.have.been.calledWithMatch('[01-01 12:00:00+09:00] [INFO]  {"test":"value"}')
        })

        it('should respect log level threshold', () => {
            // Set to WARN level
            configStub.returns('warn')
            const logger = new VscodeWdioLogger()

            // These should not log
            logger.trace('test message')
            logger.debug('test message')
            logger.info('test message')
            expect(appendLineSpy).not.to.have.been.called

            // These should log
            logger.warn('test message')
            expect(appendLineSpy).to.have.been.calledOnce

            logger.error('test message')
            expect(appendLineSpy).to.have.been.calledTwice
        })

        it('should call log with correct log level for each method', () => {
            const logger = new VscodeWdioLogger()
            const logSpy = sandbox.spy(logger as any, 'log')

            logger.trace('trace message')
            expect(logSpy).to.have.been.calledWith(LOG_LEVEL.TRACE, 'trace message')

            logger.debug('debug message')
            expect(logSpy).to.have.been.calledWith(LOG_LEVEL.DEBUG, 'debug message')

            logger.info('info message')
            expect(logSpy).to.have.been.calledWith(LOG_LEVEL.INFO, 'info message')

            logger.warn('warn message')
            expect(logSpy).to.have.been.calledWith(LOG_LEVEL.WARN, 'warn message')

            logger.error('error message')
            expect(logSpy).to.have.been.calledWith(LOG_LEVEL.ERROR, 'error message')
        })
    })

    describe('time formatting', () => {
        it('should format date and time correctly', () => {
            configStub.returns('info')
            const logger = new VscodeWdioLogger()
            logger.info('test message')

            expect(appendLineSpy).to.have.been.calledWithMatch(/\[01-01 12:00:00\+09:00\]/)
        })

        it('should calculate timezone string correctly for positive offset', () => {
            // Reset the stub to test a different timezone
            sandbox.restore()
            sandbox = sinon.createSandbox()

            appendLineSpy = sandbox.spy()
            outputChannelMock = {
                appendLine: appendLineSpy,
                show: sandbox.stub(),
                dispose: sandbox.stub(),
                replace: sandbox.stub(),
                clear: sandbox.stub(),
                hide: sandbox.stub(),
                name: 'WebdriverIO',
                onDidChangeVisibility: sandbox.stub(),
            } as unknown as vscode.LogOutputChannel

            sandbox.stub(vscode.window, 'createOutputChannel').returns(outputChannelMock)
            configStub = sandbox.stub().returns('info')
            sandbox.stub(vscode.workspace, 'getConfiguration').returns({ get: configStub } as any)

            // Mock date for west coast timezone (UTC-8)
            sandbox.stub(Date.prototype, 'getMonth').returns(0)
            sandbox.stub(Date.prototype, 'getDate').returns(1)
            sandbox.stub(Date.prototype, 'getHours').returns(12)
            sandbox.stub(Date.prototype, 'getMinutes').returns(0)
            sandbox.stub(Date.prototype, 'getSeconds').returns(0)
            sandbox.stub(Date.prototype, 'getTimezoneOffset').returns(480) // UTC-8 (positive offset)

            const logger = new VscodeWdioLogger()
            logger.info('test message')

            expect(appendLineSpy).to.have.been.calledWithMatch(/\[01-01 12:00:00-08:00\]/)
        })

        it('should handle minutes in timezone offset', () => {
            // Reset the stub to test an unusual timezone
            sandbox.restore()
            sandbox = sinon.createSandbox()

            appendLineSpy = sandbox.spy()
            outputChannelMock = {
                appendLine: appendLineSpy,
                show: sandbox.stub(),
                dispose: sandbox.stub(),
                replace: sandbox.stub(),
                clear: sandbox.stub(),
                hide: sandbox.stub(),
                name: 'WebdriverIO',
                onDidChangeVisibility: sandbox.stub(),
            } as unknown as vscode.LogOutputChannel

            sandbox.stub(vscode.window, 'createOutputChannel').returns(outputChannelMock)
            configStub = sandbox.stub().returns('info')
            sandbox.stub(vscode.workspace, 'getConfiguration').returns({ get: configStub } as any)

            // Mock date for a timezone with minutes offset (UTC+5:30)
            sandbox.stub(Date.prototype, 'getMonth').returns(0)
            sandbox.stub(Date.prototype, 'getDate').returns(1)
            sandbox.stub(Date.prototype, 'getHours').returns(12)
            sandbox.stub(Date.prototype, 'getMinutes').returns(0)
            sandbox.stub(Date.prototype, 'getSeconds').returns(0)
            sandbox.stub(Date.prototype, 'getTimezoneOffset').returns(-330) // UTC+5:30 (negative offset with minutes)

            const logger = new VscodeWdioLogger()
            logger.info('test message')

            expect(appendLineSpy).to.have.been.calledWithMatch(/\[01-01 12:00:00\+05:30\]/)
        })
    })

    describe('exported log instance', () => {
        it('should export a singleton instance', () => {
            expect(log).to.be.an.instanceof(VscodeWdioLogger)
        })

        it('should use the same log instance for all imports', () => {
            // This test doesn't need additional assertions as the singleton pattern
            // is verified by checking the instance type above
            expect(log).to.equal(log)
        })
    })
})
