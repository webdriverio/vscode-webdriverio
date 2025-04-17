import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { discoverTests } from '../../src/test/discover.js'
import { configManager } from '../../src/config/index.js'
import { log } from '../../src/utils/logger.js'

import type { ConfigParser } from '@wdio/config/node'

// Mock dependencies
vi.mock('../../src/utils/logger.js', () => ({
    log: {
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
    },
}))
vi.mock('../../src/config/index.js', () => ({
    configManager: {
        getWorkspaceFolderPath: vi.fn(),
        getWdioConfig: vi.fn(),
    },
}))

describe('Test Discovery', () => {
    // Mock test registry
    const mockTestRegistry = {
        resisterSpecs: vi.fn().mockResolvedValue(undefined),
    }

    // Mock workspace and config data
    const mockWorkspaceFolder = '/mock/workspace'
    const mockSpecFiles = [
        'file:///mock/workspace/test/spec1.js',
        'file:///mock/workspace/test/spec2.js',
        'file:///mock/workspace/test/spec3.js',
    ]
    const mockSpecFilesAsArray = [
        ['file:///mock/workspace/test/spec1.js', 'file:///mock/workspace/test/spec2.js'],
        'file:///mock/workspace/test/spec3.js',
    ]
    const mockConfig = {
        getSpecs: vi.fn(),
    } as unknown as ConfigParser

    beforeEach(() => {
        vi.resetAllMocks()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('discoverTests', () => {
        it('should discover and register test specs from single workspace', async () => {
            // Setup
            vi.mocked(configManager.getWorkspaceFolderPath).mockReturnValue([mockWorkspaceFolder])
            vi.mocked(configManager.getWdioConfig).mockResolvedValue(mockConfig)
            vi.mocked(mockConfig.getSpecs).mockReturnValue(mockSpecFiles)

            // Execute
            await discoverTests(mockTestRegistry as any)

            // Verify
            expect(configManager.getWorkspaceFolderPath).toHaveBeenCalled()
            expect(configManager.getWdioConfig).toHaveBeenCalledWith(mockWorkspaceFolder)
            expect(mockConfig.getSpecs).toHaveBeenCalled()
            expect(log.debug).toHaveBeenCalledWith('Loaded configuration successfully.')
            expect(log.debug).toHaveBeenCalledWith(`Detected spec files: ${mockSpecFiles.length}`)

            // Check if specs were registered with the registry
            expect(mockTestRegistry.resisterSpecs).toHaveBeenCalled()
            const registeredSpecs = vi.mocked(mockTestRegistry.resisterSpecs).mock.calls[0][0]
            expect(registeredSpecs).toHaveLength(mockSpecFiles.length)
            expect(registeredSpecs).toEqual(mockSpecFiles.map((spec) => spec.replace('file://', '')))
        })

        it('should handle array of spec files correctly', async () => {
            // Setup
            vi.mocked(configManager.getWorkspaceFolderPath).mockReturnValue([mockWorkspaceFolder])
            vi.mocked(configManager.getWdioConfig).mockResolvedValue(mockConfig)
            vi.mocked(mockConfig.getSpecs).mockReturnValue(mockSpecFilesAsArray)

            // Execute
            await discoverTests(mockTestRegistry as any)

            // Verify
            expect(mockTestRegistry.resisterSpecs).toHaveBeenCalled()
            const registeredSpecs = vi.mocked(mockTestRegistry.resisterSpecs).mock.calls[0][0]
            expect(registeredSpecs).toHaveLength(3) // Total number of specs across all arrays
        })

        it('should log warning for multiple workspaces', async () => {
            // Setup - Multiple workspaces
            vi.mocked(configManager.getWorkspaceFolderPath).mockReturnValue(['/workspace1', '/workspace2'])

            // Execute
            await discoverTests(mockTestRegistry as any)

            // Verify
            expect(log.debug).toHaveBeenCalledWith('Detected 2 workspaces.')
            expect(log.warn).toHaveBeenCalledWith('Not support the multiple workspaces')
            expect(mockTestRegistry.resisterSpecs).not.toHaveBeenCalled()
        })

        it('should handle error when loading config', async () => {
            // Setup
            vi.mocked(configManager.getWorkspaceFolderPath).mockReturnValue([mockWorkspaceFolder])
            vi.mocked(configManager.getWdioConfig).mockResolvedValue(undefined)

            // Execute
            await discoverTests(mockTestRegistry as any)

            // Verify
            expect(log.error).toHaveBeenCalledWith('Failed to load specs: Failed to load the configuration.')
            expect(mockTestRegistry.resisterSpecs).not.toHaveBeenCalled()
        })

        it('should handle error thrown during config loading', async () => {
            // Setup
            const errorMessage = 'Config loading failed'
            vi.mocked(configManager.getWorkspaceFolderPath).mockReturnValue([mockWorkspaceFolder])
            vi.mocked(configManager.getWdioConfig).mockRejectedValue(new Error(errorMessage))

            // Execute
            await discoverTests(mockTestRegistry as any)

            // Verify
            expect(log.error).toHaveBeenCalledWith(`Failed to load specs: ${errorMessage}`)
            expect(mockTestRegistry.resisterSpecs).not.toHaveBeenCalled()
        })
    })
})
