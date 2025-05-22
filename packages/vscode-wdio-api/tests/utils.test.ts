import * as fs from 'node:fs/promises'

import { LOG_LEVEL } from '@vscode-wdio/constants'
import { log } from '@vscode-wdio/logger'
import { describe, it, vi, expect, beforeEach, afterEach } from 'vitest'
import which from 'which'

import { loggingFn, resolveNodePath } from '../src/utils.js'
import type { ExtensionConfigManagerInterface } from '@vscode-wdio/types/config'

vi.mock('vscode', async () => import('../../../tests/__mocks__/vscode.cjs'))
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

vi.mock('fs/promises', () => ({
    access: vi.fn(),
    constants: { X_OK: 1 },
}))

vi.mock('which', () => ({
    default: vi.fn(),
}))

describe('loggingFn', () => {
    it('should call the appropriate log method based on log level', async () => {
        // Test each log level
        await loggingFn(LOG_LEVEL.TRACE, 'trace message')
        expect(log.trace).toHaveBeenCalledWith('trace message')

        await loggingFn(LOG_LEVEL.DEBUG, 'debug message')
        expect(log.debug).toHaveBeenCalledWith('debug message')

        await loggingFn(LOG_LEVEL.INFO, 'info message')
        expect(log.info).toHaveBeenCalledWith('info message')

        await loggingFn(LOG_LEVEL.WARN, 'warn message')
        expect(log.warn).toHaveBeenCalledWith('warn message')

        await loggingFn(LOG_LEVEL.ERROR, 'error message')
        expect(log.error).toHaveBeenCalledWith('error message')

        // Test default case
        // @ts-expect-error
        await loggingFn(999, 'unknown level message')
        expect(log.debug).toHaveBeenCalledWith('unknown level message')
    })
})

describe('resolveNodePath', () => {
    // Mock config manager
    const mockConfigManager = {
        globalConfig: {
            nodeExecutable: '',
        },
    } as unknown as ExtensionConfigManagerInterface

    // Import which module after mocking

    beforeEach(() => {
        // Reset all mocks before each test
        vi.resetAllMocks()
    })

    afterEach(() => {
        // Restore all mocks after each test
        vi.restoreAllMocks()
    })

    it('should return configuredPath when it exists and is executable', async () => {
        // Arrange
        mockConfigManager.globalConfig.nodeExecutable = '/configured/path/to/node'
        vi.mocked(fs.access).mockResolvedValue(undefined) // Access check passes

        // Act
        const result = await resolveNodePath(mockConfigManager)

        // Assert
        expect(result).toBe('/configured/path/to/node')
        expect(fs.access).toHaveBeenCalledWith('/configured/path/to/node', fs.constants.X_OK)
        expect(log.debug).toHaveBeenCalledWith('Resolving the Node executable path')
        expect(log.debug).toHaveBeenCalledWith('Access check: /configured/path/to/node')
        expect(log.debug).toHaveBeenCalledWith('Resolved executable path: /configured/path/to/node')
    })

    it('should return path from which when configuredPath is not set', async () => {
        // Arrange
        mockConfigManager.globalConfig.nodeExecutable = undefined
        vi.mocked(which).mockResolvedValue('/path/from/which/node')
        vi.mocked(fs.access).mockResolvedValue(undefined) // Access check passes

        // Act
        const result = await resolveNodePath(mockConfigManager)

        // Assert
        expect(result).toBe('/path/from/which/node')
        expect(which).toHaveBeenCalledWith('node', { nothrow: true })
        expect(fs.access).toHaveBeenCalledWith('/path/from/which/node', fs.constants.X_OK)
        expect(log.debug).toHaveBeenCalledWith('Resolving the Node executable path')
        expect(log.debug).toHaveBeenCalledWith('Access check: /path/from/which/node')
        expect(log.debug).toHaveBeenCalledWith('Resolved executable path: /path/from/which/node')
    })

    it('should return path from which when configuredPath fails access check', async () => {
        // Arrange
        mockConfigManager.globalConfig.nodeExecutable = '/configured/path/to/node'
        // First access check fails
        vi.mocked(fs.access).mockRejectedValueOnce(new Error('Permission denied'))
        // Second access check passes
        vi.mocked(fs.access).mockResolvedValueOnce(undefined)
        vi.mocked(which).mockResolvedValue('/path/from/which/node')

        // Act
        const result = await resolveNodePath(mockConfigManager)

        // Assert
        expect(result).toBe('/path/from/which/node')
        expect(fs.access).toHaveBeenCalledWith('/configured/path/to/node', fs.constants.X_OK)
        expect(fs.access).toHaveBeenCalledWith('/path/from/which/node', fs.constants.X_OK)
        expect(which).toHaveBeenCalledWith('node', { nothrow: true })
        expect(log.debug).toHaveBeenCalledWith('Access check: /configured/path/to/node')
        expect(log.debug).toHaveBeenCalledWith('Access check was failed: Permission denied')
    })

    it('should throw error when both configuredPath and which fail', async () => {
        // Arrange
        mockConfigManager.globalConfig.nodeExecutable = '/configured/path/to/node'
        // All access checks fail
        vi.mocked(fs.access).mockRejectedValue(new Error('Permission denied'))
        vi.mocked(which).mockResolvedValue('/path/from/which/node')

        // Mock process.env.PATH for error message
        const originalEnv = process.env
        process.env = { ...originalEnv, PATH: '/usr/bin:/bin' }

        // Act & Assert
        await expect(resolveNodePath(mockConfigManager)).rejects.toThrow(
            "Unable to find 'node' executable.\nMake sure to have Node.js installed and available in your PATH.\nCurrent PATH: '/usr/bin:/bin'."
        )

        // Restore process.env
        process.env = originalEnv

        expect(log.error).toHaveBeenCalledWith(
            "Unable to find 'node' executable.\nMake sure to have Node.js installed and available in your PATH.\nCurrent PATH: '/usr/bin:/bin'."
        )
    })

    it('should throw error when which returns null', async () => {
        // Arrange
        mockConfigManager.globalConfig.nodeExecutable = undefined
        //@ts-ignore
        vi.mocked(which).mockResolvedValue(null)

        // Mock process.env.PATH for error message
        const originalEnv = process.env
        process.env = { ...originalEnv, PATH: '/usr/bin:/bin' }

        // Act & Assert
        await expect(resolveNodePath(mockConfigManager)).rejects.toThrow(
            "Unable to find 'node' executable.\nMake sure to have Node.js installed and available in your PATH.\nCurrent PATH: '/usr/bin:/bin'."
        )

        // Restore process.env
        process.env = originalEnv
    })

    it('should handle non-Error objects in checkExistence', async () => {
        // Arrange
        mockConfigManager.globalConfig.nodeExecutable = '/configured/path/to/node'
        // Access check throws a non-Error object
        vi.mocked(fs.access).mockRejectedValueOnce('String error')
        //@ts-ignore
        vi.mocked(which).mockResolvedValue(null)

        // Mock process.env.PATH for error message
        const originalEnv = process.env
        process.env = { ...originalEnv, PATH: '/usr/bin:/bin' }

        // Act & Assert
        await expect(resolveNodePath(mockConfigManager)).rejects.toThrow(
            "Unable to find 'node' executable.\nMake sure to have Node.js installed and available in your PATH.\nCurrent PATH: '/usr/bin:/bin'."
        )

        // Restore process.env
        process.env = originalEnv

        // Check that the string error was properly logged
        expect(log.debug).toHaveBeenCalledWith('Access check was failed: String error')
    })
})
