import fs from 'node:fs/promises'
import path from 'node:path'

import { glob } from 'glob'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { findWdioConfig } from '../src/find.js'

// Mock dependencies
vi.mock('node:fs/promises')
vi.mock('glob')

vi.mock('vscode', async () => import('../../../tests/__mocks__/vscode.cjs'))
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

describe('findWdioConfig', () => {
    const mockWorkspaceRoot = '/mock/workspace'
    const defaultConfigFilePattern = ['wdio.conf.js', 'wdio.conf.ts']

    beforeEach(() => {
        vi.resetAllMocks()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('should find config files when they exist', async () => {
        // Setup
        const mockConfigFiles = ['wdio.conf.js', 'wdio.conf.ts']
        const expectedPaths = mockConfigFiles.map((file) => path.join(mockWorkspaceRoot, file))

        // Mock glob to return the config files
        vi.mocked(glob).mockResolvedValue(mockConfigFiles)

        // Mock fs.access to succeed for all files
        vi.mocked(fs.access).mockResolvedValue(undefined)

        // Execute
        const result = await findWdioConfig(mockWorkspaceRoot, defaultConfigFilePattern)

        // Verify
        expect(result).toEqual(expectedPaths)
        expect(glob).toHaveBeenCalledWith(defaultConfigFilePattern, {
            cwd: mockWorkspaceRoot,
            withFileTypes: false,
            ignore: '**/node_modules/**',
        })
        expect(fs.access).toHaveBeenCalledTimes(2)
    })

    it('should filter out inaccessible files', async () => {
        // Setup
        const mockConfigFiles = ['wdio.conf.js', 'wdio.conf.ts']
        const accessibleFile = path.join(mockWorkspaceRoot, 'wdio.conf.js')

        // Mock glob to return the config files
        vi.mocked(glob).mockResolvedValue(mockConfigFiles)

        // Mock fs.access to succeed only for the JS file
        vi.mocked(fs.access).mockImplementation(async (filePath) => {
            if (filePath === accessibleFile) {
                return Promise.resolve()
            }
            return Promise.reject(new Error('File not found'))
        })

        // Execute
        const result = await findWdioConfig(mockWorkspaceRoot, defaultConfigFilePattern)

        // Verify
        expect(result).toEqual([accessibleFile])
        expect(fs.access).toHaveBeenCalledTimes(2)
    })

    it('should return empty array when no config files are accessible', async () => {
        // Setup
        const mockConfigFiles = ['wdio.conf.js', 'wdio.conf.ts']

        // Mock glob to return the config files
        vi.mocked(glob).mockResolvedValue(mockConfigFiles)

        // Mock fs.access to fail for all files
        vi.mocked(fs.access).mockRejectedValue(new Error('File not found'))

        // Execute
        const result = await findWdioConfig(mockWorkspaceRoot, defaultConfigFilePattern)

        // Verify
        expect(result).toEqual([])
        expect(fs.access).toHaveBeenCalledTimes(2)
    })

    it('should handle empty glob results', async () => {
        // Setup
        // Mock glob to return no files
        vi.mocked(glob).mockResolvedValue([])

        // Execute
        const result = await findWdioConfig(mockWorkspaceRoot, defaultConfigFilePattern)

        // Verify
        expect(result).toEqual([])
        expect(fs.access).not.toHaveBeenCalled()
    })

    it('should use custom config file pattern when provided', async () => {
        // Setup
        const customConfigPattern = ['custom.wdio.conf.js']
        const mockConfigFiles = ['custom.wdio.conf.js']
        const expectedPaths = mockConfigFiles.map((file) => path.join(mockWorkspaceRoot, file))

        // Mock glob to return the config files
        vi.mocked(glob).mockResolvedValue(mockConfigFiles)

        // Mock fs.access to succeed
        vi.mocked(fs.access).mockResolvedValue(undefined)

        // Execute
        const result = await findWdioConfig(mockWorkspaceRoot, customConfigPattern)

        // Verify
        expect(result).toEqual(expectedPaths)
        expect(glob).toHaveBeenCalledWith(customConfigPattern, {
            cwd: mockWorkspaceRoot,
            withFileTypes: false,
            ignore: '**/node_modules/**',
        })
    })
})
