import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { LOG_LEVEL } from '../../src/constants.js'
import { getLogger } from '../../src/worker/logger'
import type { ExtensionApi } from '../../src/api/index.js'

describe('Logger', () => {
    // Mock the ExtensionApi client
    const mockClient: ExtensionApi = {
        log: vi.fn(),
        // Add other required properties of ExtensionApi if needed
    } as unknown as ExtensionApi

    // Spy on console.log for error case testing
    let consoleLogSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        // Reset all mocks before each test
        vi.resetAllMocks()
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    afterEach(() => {
        // Restore all mocks after each test
        vi.restoreAllMocks()
    })

    it('should create a new logger instance', () => {
        // Arrange & Act
        const logger = getLogger(mockClient)

        // Assert
        expect(logger).toBeDefined()
        expect(logger).toHaveProperty('trace')
        expect(logger).toHaveProperty('debug')
        expect(logger).toHaveProperty('info')
        expect(logger).toHaveProperty('warn')
        expect(logger).toHaveProperty('error')
    })

    it('should return the same logger instance for the same client', () => {
        // Arrange & Act
        const logger1 = getLogger(mockClient)
        const logger2 = getLogger(mockClient)

        // Assert
        expect(logger1).toBe(logger2)
    })

    it('should return different logger instances for different clients', () => {
        // Arrange
        const mockClient2: ExtensionApi = {
            log: vi.fn(),
        } as unknown as ExtensionApi

        // Act
        const logger1 = getLogger(mockClient)
        const logger2 = getLogger(mockClient2)

        // Assert
        expect(logger1).not.toBe(logger2)
    })

    it('should call client.log with the correct log level and message for string messages', () => {
        // Arrange
        const logger = getLogger(mockClient)
        const testMessage = 'Test log message'

        // Act
        logger.trace(testMessage)
        logger.debug(testMessage)
        logger.info(testMessage)
        logger.warn(testMessage)
        logger.error(testMessage)

        // Assert
        expect(mockClient.log).toHaveBeenCalledTimes(5)
        expect(mockClient.log).toHaveBeenNthCalledWith(1, LOG_LEVEL.TRACE, testMessage)
        expect(mockClient.log).toHaveBeenNthCalledWith(2, LOG_LEVEL.DEBUG, testMessage)
        expect(mockClient.log).toHaveBeenNthCalledWith(3, LOG_LEVEL.INFO, testMessage)
        expect(mockClient.log).toHaveBeenNthCalledWith(4, LOG_LEVEL.WARN, testMessage)
        expect(mockClient.log).toHaveBeenNthCalledWith(5, LOG_LEVEL.ERROR, testMessage)
    })

    it('should stringify non-string messages before logging', () => {
        // Arrange
        const logger = getLogger(mockClient)
        const testObject = { test: 'value', nested: { prop: 123 } }
        const expectedStringified = JSON.stringify(testObject)

        // Act
        logger.info(testObject)

        // Assert
        expect(mockClient.log).toHaveBeenCalledWith(LOG_LEVEL.INFO, expectedStringified)
    })

    it('should handle errors in client.log by using console.log', () => {
        // Arrange
        mockClient.log = vi.fn().mockImplementation(() => {
            throw new Error('Client log error')
        })
        const logger = getLogger(mockClient)

        // Act
        logger.info('Test message')

        // Assert
        expect(consoleLogSpy).toHaveBeenCalledWith('Client log error')
    })

    it('should handle non-Error exceptions by converting to string', () => {
        // Arrange
        mockClient.log = vi.fn().mockImplementation(() => {
            // eslint-disable-next-line no-throw-literal
            throw 'String error' // Non-Error exception
        })
        const logger = getLogger(mockClient)

        // Act
        logger.info('Test message')

        // Assert
        expect(consoleLogSpy).toHaveBeenCalledWith('String error')
    })

    it('should handle errors during JSON.stringify', () => {
        // Arrange
        const logger = getLogger(mockClient)

        // Create an object with circular reference that will cause JSON.stringify to throw
        const circularObj: any = {}
        circularObj.self = circularObj

        // Act
        logger.info(circularObj)

        // Assert
        expect(consoleLogSpy).toHaveBeenCalled()
        // The exact error message may vary across environments,
        // so we just check that it was called
    })
})
