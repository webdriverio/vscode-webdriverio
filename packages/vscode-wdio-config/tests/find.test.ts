import fs from 'node:fs/promises'
import path from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

import { findWdioConfig } from '../src/find.js'

// Mock dependencies
vi.mock('node:fs/promises')
vi.mock('glob')

vi.mock('vscode', async () => {
    const vscode = await import('../../../tests/__mocks__/vscode.cjs')
    return {
        ...vscode,
        RelativePattern: vi.fn(),
        workspace: {
            findFiles: vi.fn(),
        },
    }
})
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

describe('findWdioConfig', () => {
    const mockWorkspaceRoot = '/mock/workspace'
    const defaultConfigFilePattern = ['wdio.conf.js', 'wdio.conf.ts']

    beforeEach(() => {
        vi.resetAllMocks()
        vi.mocked(vscode.RelativePattern).mockImplementation(function (this: any, r: unknown, p: string) {
            this.path = p
            this.root = r
            this.toString = function () {
                return path.join(this.root, this.path)
            }
        } as any)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('should find config files when they exist', async () => {
        // Setup
        const mockConfigFiles = ['wdio.conf.js', 'wdio.conf.ts']
        const expectedPaths = mockConfigFiles.map((file) => path.join(mockWorkspaceRoot, file))

        vi.mocked(vscode.workspace.findFiles).mockImplementation(async (p: vscode.GlobPattern) => {
            return [vscode.Uri.file(p.toString())]
        })
        // Mock fs.access to succeed for all files
        vi.mocked(fs.access).mockResolvedValue(undefined)

        // Execute
        const result = await findWdioConfig(mockWorkspaceRoot, defaultConfigFilePattern)

        // Verify
        expect(result).toEqual(expectedPaths)
        expect(fs.access).toHaveBeenCalledTimes(2)
    })

    it('should filter out inaccessible files', async () => {
        // Setup
        const accessibleFile = path.join(mockWorkspaceRoot, 'wdio.conf.js')

        vi.mocked(vscode.workspace.findFiles).mockImplementation(async (p: vscode.GlobPattern) => {
            return [vscode.Uri.file(p.toString())]
        })

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
        vi.mocked(vscode.workspace.findFiles).mockImplementation(async (p: vscode.GlobPattern) => {
            return [vscode.Uri.file(p.toString())]
        })

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
        vi.mocked(vscode.workspace.findFiles).mockResolvedValue([])

        // Execute
        const result = await findWdioConfig(mockWorkspaceRoot, defaultConfigFilePattern)

        // Verify
        expect(result).toEqual([])
        expect(fs.access).not.toHaveBeenCalled()
    })
})
