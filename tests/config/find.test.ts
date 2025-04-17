import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs/promises'
import { findWdioConfig } from '../../src/config/find.js'
import { log } from '../../src/utils/logger.js'

// Mock dependencies
vi.mock('node:fs/promises')
vi.mock('../../src/utils/logger', () => ({
    log: {
        debug: vi.fn(),
    },
}))

describe('findWdioConfig', () => {
    const mockWorkspaceRoot = '/mock/workspace'

    beforeEach(() => {
        vi.resetAllMocks()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    it('should find JS config file when it exists', async () => {
        // Setup
        const expectedPath = path.join(mockWorkspaceRoot, 'wdio.conf.js')

        // Mock fs.access to succeed for JS file and fail for TS file
        vi.mocked(fs.access).mockImplementation(async (path) => {
            if (path === expectedPath) {
                return Promise.resolve()
            }
            return Promise.reject(new Error('File not found'))
        })

        // Execute
        const result = await findWdioConfig(mockWorkspaceRoot)

        // Verify
        expect(result).toBe(expectedPath)
        expect(fs.access).toHaveBeenCalledTimes(2)
        expect(log.debug).toHaveBeenCalledWith(`Target workspace path: ${mockWorkspaceRoot}`)
        expect(log.debug).toHaveBeenCalledWith('Detecting the configuration file for WebdriverIO...')
        expect(log.debug).toHaveBeenCalledWith(`Detected file: ${expectedPath}`)
    })

    it('should find TS config file when it exists', async () => {
        // Setup
        const expectedPath = path.join(mockWorkspaceRoot, 'wdio.conf.ts')

        // Mock fs.access to fail for JS file and succeed for TS file
        vi.mocked(fs.access).mockImplementation(async (path) => {
            if (path === expectedPath) {
                return Promise.resolve()
            }
            return Promise.reject(new Error('File not found'))
        })

        // Execute
        const result = await findWdioConfig(mockWorkspaceRoot)

        // Verify
        expect(result).toBe(expectedPath)
        expect(fs.access).toHaveBeenCalledTimes(2)
    })

    it('should handle both config files existing', async () => {
        // Setup
        const jsPath = path.join(mockWorkspaceRoot, 'wdio.conf.js')
        // const tsPath = path.join(mockWorkspaceRoot, 'wdio.conf.ts')

        // Mock fs.access to succeed for both files
        vi.mocked(fs.access).mockResolvedValue()

        // Execute
        const result = await findWdioConfig(mockWorkspaceRoot)

        // Verify
        expect(result).toBe(jsPath) // Should return the first one (JS)
        expect(fs.access).toHaveBeenCalledTimes(2)
        expect(log.debug).toHaveBeenCalledWith(`${2} configuration files were detected. Use first one. `)
    })

    it('should handle no config files existing', async () => {
        // Setup
        // Mock fs.access to fail for both files
        vi.mocked(fs.access).mockRejectedValue(new Error('File not found'))

        // Execute
        const result = await findWdioConfig(mockWorkspaceRoot)

        // Verify
        expect(result).toBeUndefined()
        expect(fs.access).toHaveBeenCalledTimes(2)
        expect(log.debug).toHaveBeenCalledWith('There is no configuration file.')
    })
})
