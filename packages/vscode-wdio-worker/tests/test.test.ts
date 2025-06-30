import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { getLauncherInstance } from '../src/cli.js'
import { runTest } from '../src/test.js'
import { getTempConfigCreator, isWindows } from '../src/utils.js'
import type { Dirent } from 'node:fs'
import type { RunTestOptions } from '@vscode-wdio/types'
import type { WorkerMetaContext } from '@vscode-wdio/types/worker'

// Mock dependencies
vi.mock('node:fs/promises')
vi.mock('node:os')
vi.mock('../src/cli.js', () => {
    const getLauncherInstance = vi.fn(() =>
        Promise.resolve({
            run: vi.fn(() => 0),
        })
    )
    return { getLauncherInstance }
})

vi.mock('../src/utils.js', () => {
    return {
        isWindows: vi.fn(() => false),
        isFixedWdio: vi.fn(() => false),
        getTempConfigCreator: vi.fn(),
    }
})

describe('runTest', () => {
    const mockLog = {
        info: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        error: vi.fn(),
    }

    const mockContext = {
        log: mockLog,
    } as unknown as WorkerMetaContext

    const mockConfigFile = '/path/to/wdio.conf.js'
    const mockEnv = {
        paths: [],
        override: false,
    }
    const mockOptions: RunTestOptions = {
        configPath: mockConfigFile,
        specs: ['test.spec.js'],
        grep: 'test pattern',
        env: mockEnv,
    }

    // Mock temporary directories and files
    const mockTmpDir = '/mock/tmp/dir'
    const mockResultDir = '/mock/tmp/dir/result-xyz123'
    const mockResultFile = 'wdio-0-0.json'
    const mockResultData = JSON.stringify({ some: 'test result' })
    const mockTempConfigCreator = vi.fn(async () => '/path/to/customized/wdio.conf.ts')

    beforeEach(() => {
        // Reset mocks
        vi.resetAllMocks()

        // Setup mocks for fs and os
        vi.mocked(os.tmpdir).mockReturnValue(mockTmpDir)

        vi.mocked(fs.mkdir).mockResolvedValue(undefined)
        vi.mocked(fs.mkdtemp).mockResolvedValue(mockResultDir)
        vi.mocked(fs.access).mockResolvedValue(undefined)
        // @ts-ignore
        vi.mocked(fs.readdir).mockResolvedValue([mockResultFile as unknown as Dirent])
        vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(mockResultData))
        vi.mocked(fs.rm).mockResolvedValue(undefined)

        vi.mocked(getTempConfigCreator).mockResolvedValue(mockTempConfigCreator)

        // Mock console methods
        vi.spyOn(console, 'log').mockImplementation(() => {})
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        // Restore console methods
        vi.restoreAllMocks()
    })

    it('should run tests successfully and return results', async () => {
        // Act
        const result = await runTest.call(mockContext, mockOptions)

        // Assert
        expect(result.success).toBe(true)
        expect(result.json).toHaveLength(1)
        expect(result.json[0]).toEqual({ some: 'test result' })

        // Verify logger was called with expected messages
        expect(mockLog.info).toHaveBeenCalledWith('Launching WebdriverIO...')
        expect(mockLog.info).toHaveBeenCalledWith('Tests completed with exit code: 0')

        // Verify temporary directories were created
        expect(fs.mkdir).toHaveBeenCalledWith(join(mockTmpDir, 'vscode-webdriverio'), { recursive: true })
        expect(fs.mkdtemp).toHaveBeenCalledWith(join(mockTmpDir, 'vscode-webdriverio', 'result-'))

        // Verify result files were read
        expect(fs.readdir).toHaveBeenCalledWith(mockResultDir)
        expect(fs.readFile).toHaveBeenCalledWith(join(mockResultDir, mockResultFile))

        // Verify cleanup happened
        expect(fs.rm).toHaveBeenCalledWith(mockResultDir, { recursive: true, force: true })
    })

    it('should run tests successfully and return results on the windows', async () => {
        vi.mocked(isWindows).mockReturnValue(true)
        // Act
        const result = await runTest.call(mockContext, mockOptions)

        // Assert
        expect(result.success).toBe(true)
        expect(result.json).toHaveLength(1)
        expect(result.json[0]).toEqual({ some: 'test result' })

        // Verify logger was called with expected messages
        expect(mockLog.info).toHaveBeenCalledWith('Launching WebdriverIO...')
        expect(mockLog.info).toHaveBeenCalledWith('Tests completed with exit code: 0')

        // Verify temporary directories were created
        expect(fs.mkdir).toHaveBeenCalledWith(join(mockTmpDir, 'vscode-webdriverio'), { recursive: true })
        expect(fs.mkdtemp).toHaveBeenCalledWith(join(mockTmpDir, 'vscode-webdriverio', 'result-'))

        // Verify createTempConfigFile were called
        expect(mockTempConfigCreator).toHaveBeenCalledWith(mockConfigFile, mockResultDir)

        // Verify result files were read
        expect(fs.readdir).toHaveBeenCalledWith(mockResultDir)
        expect(fs.readFile).toHaveBeenCalledWith(join(mockResultDir, mockResultFile))

        // Verify cleanup happened
        expect(fs.rm).toHaveBeenCalledWith(mockResultDir, { recursive: true, force: true })
        expect(fs.rm).toHaveBeenCalledWith(mockOptions.configPath, { recursive: true, force: true })
    })

    it('should handle tests with no specs provided', async () => {
        // Arrange
        const optionsNoSpecs = {
            configPath: '/path/to/wdio.conf.js',
            env: mockEnv,
        }

        // Act
        const result = await runTest.call(mockContext, optionsNoSpecs)

        // Assert
        expect(result.success).toBe(true)
    })

    it('should handle tests with no grep pattern', async () => {
        // Arrange
        const optionsNoGrep = {
            configPath: '/path/to/wdio.conf.js',
            specs: ['test.spec.js'],
            env: mockEnv,
        }

        // Act
        const result = await runTest.call(mockContext, optionsNoGrep)

        // Assert
        expect(result.success).toBe(true)
    })

    it('should handle test failure', async () => {
        // Arrange - Mock Launcher to return non-zero exit code
        vi.mocked(getLauncherInstance).mockResolvedValue({
            run: vi.fn(() => Promise.resolve(1)),
        } as any)

        // Act
        const result = await runTest.call(mockContext, mockOptions)

        // Assert
        expect(result.success).toBe(false)
        expect(mockLog.info).toHaveBeenCalledWith('Tests completed with exit code: 1')
    })

    it('should handle error when creating output directory', async () => {
        // Arrange
        vi.mocked(fs.mkdir).mockRejectedValue(new Error('mkdir error'))

        // Act
        const result = await runTest.call(mockContext, mockOptions)

        // Assert
        expect(result.success).toBe(true)
        expect(result.json).toEqual([])
        expect(mockLog.debug).toHaveBeenCalledWith('Failed to create output directory: mkdir error')
    })

    it('should handle error when accessing output directory', async () => {
        // Arrange
        vi.mocked(fs.access).mockRejectedValue(new Error('access error'))

        // Act
        const result = await runTest.call(mockContext, mockOptions)

        // Assert
        expect(result.success).toBe(true)
        expect(result.json).toEqual([])
        expect(mockLog.debug).toHaveBeenCalledWith('Result file could not be read: access error')
    })

    it('should handle error when reading directory contents', async () => {
        // Arrange
        vi.mocked(fs.readdir).mockRejectedValue(new Error('readdir error'))

        // Act
        const result = await runTest.call(mockContext, mockOptions)

        // Assert
        expect(result.success).toBe(true)
        expect(result.json).toEqual([])
        expect(mockLog.debug).toHaveBeenCalledWith('Result file could not be read: readdir error')
    })

    it('should handle error when reading result file', async () => {
        // Arrange
        vi.mocked(fs.readFile).mockRejectedValue(new Error('readFile error'))

        // Act
        const result = await runTest.call(mockContext, mockOptions)

        // Assert
        expect(result.success).toBe(true)
        expect(result.json).toEqual([])
        expect(mockLog.debug).toHaveBeenCalledWith('Result file could not be read: readFile error')
    })

    it('should handle error when removing result directory', async () => {
        // Arrange
        vi.mocked(fs.rm).mockRejectedValue(new Error('rm error'))

        // Act
        const result = await runTest.call(mockContext, mockOptions)

        // Assert
        expect(result.success).toBe(true)
        expect(mockLog.debug).toHaveBeenCalledWith('Remove Failed: rm error')
    })

    it('should handle error in Launcher', async () => {
        // Arrange - Mock Launcher to throw an error
        vi.mocked(getLauncherInstance).mockResolvedValue({
            run: vi.fn(() => Promise.reject(new Error('Launcher error'))),
        } as any)

        // Act
        const result = await runTest.call(mockContext, mockOptions)

        // Assert
        expect(result.success).toBe(false)
        expect(result.error).toBe('Launcher error')
        expect(mockLog.error).toHaveBeenCalledWith('Error in WebdriverIO runner: Launcher error')
    })

    it('should capture stdout and stderr output', async () => {
        // Arrange
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        // Simulate console output during test run
        vi.mocked(getLauncherInstance).mockResolvedValue({
            run: vi.fn(() => {
                console.log('Test output 1')
                console.log('Test output 2')
                console.error('Test error 1')
                return Promise.resolve(0)
            }),
        } as any)

        // Act
        const result = await runTest.call(mockContext, mockOptions)

        // Assert
        expect(result.stdout).toContain('Test output 1')
        expect(result.stdout).toContain('Test output 2')
        expect(result.stderr).toContain('Test error 1')

        // Verify console methods were restored
        expect(console.log).not.toBe(consoleSpy.getMockImplementation())
        expect(console.error).not.toBe(consoleErrorSpy.getMockImplementation())
    })
})
