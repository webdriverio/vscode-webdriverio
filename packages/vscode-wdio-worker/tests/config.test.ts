import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import * as configModule from '../src/config.js'

// Mock fs module
vi.mock('node:fs/promises', () => ({
    default: {
        readFile: vi.fn(),
        writeFile: vi.fn(),
    },
}))

vi.mock('node:url', () => ({
    pathToFileURL: vi.fn((file) => ({
        href: `file://${file}`,
    })),
}))

vi.mock('node:path', async (importOriginal) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-imports
    const actual = await importOriginal<typeof import('node:path')>()
    return {
        default: {
            ...actual,
            resolve: vi.fn((_, f) => path.posix.resolve(`/path/to/parser/${f}`)),
        },
    }
})

describe('config.ts', () => {
    const VSCODE_REPORTER_PATH = path.resolve(__dirname, '../reporter.cjs')
    const reporterPathUrl = pathToFileURL(VSCODE_REPORTER_PATH).href

    beforeEach(() => {
        // Reset mocks before each test
        vi.resetAllMocks()
    })

    afterEach(() => {
        // Restore spies and mocks after each test
        vi.restoreAllMocks()
    })

    describe('createTempConfigFile', () => {
        // Test for ESM format
        it('should add reporter to an ESM config file if not present', async () => {
            // Arrange
            const filename = 'wdio.conf.ts'
            const outDir = '/output/dir'
            const mockConfig = `
        import { defineConfig } from '@wdio/cli'

        export const config = defineConfig({
          runner: 'local',
          specs: ['./test/specs/**/*.ts'],
          capabilities: [{
            browserName: 'chrome'
          }],
          logLevel: 'info',
          services: ['chromedriver'],
        })
      `
            vi.mocked(fs.readFile).mockResolvedValue(mockConfig)
            vi.mocked(fs.writeFile).mockResolvedValue()

            // Act
            const result = await configModule.createTempConfigFile(filename, outDir)

            // Assertq
            expect(fs.readFile).toHaveBeenCalledWith(filename, { encoding: 'utf8' })
            const writeFileCalls = vi.mocked(fs.writeFile).mock.calls
            expect(writeFileCalls.length).toBe(1)

            // Check that the output includes the reporter import
            const outputContent = writeFileCalls[0][1] as string

            expect(outputContent).toMatchSnapshot()

            // Check the temp filename structure
            expect(result).toContain('wdio-vscode-')
            expect(result).toContain('.ts')
        })

        // Test for ESM format with existing reporters
        it('should add reporter to an ESM config with existing reporters', async () => {
            // Arrange
            const filename = 'wdio.conf.ts'
            const outDir = '/output/dir'
            const mockConfig = `
        import { defineConfig } from '@wdio/cli'

        export const config = defineConfig({
          runner: 'local',
          specs: ['./test/specs/**/*.ts'],
          reporters: ['spec', ['allure', { outputDir: 'allure-results' }]],
          capabilities: [{
            browserName: 'chrome'
          }],
        })
      `
            vi.mocked(fs.readFile).mockResolvedValue(mockConfig)
            vi.mocked(fs.writeFile).mockResolvedValue()

            // Act
            await configModule.createTempConfigFile(filename, outDir)

            // Assert
            const writeFileCalls = vi.mocked(fs.writeFile).mock.calls
            const outputContent = writeFileCalls[0][1] as string

            // Check that the reporter import is added
            expect(outputContent).toMatchSnapshot()
        })

        // Test for CJS format
        it('should add reporter to a CJS config file if not present', async () => {
            // Arrange
            const filename = 'wdio.conf.js'
            const outDir = '/output/dir'
            const mockConfig = `
                const { config } = require('@wdio/cli')

                exports.config = {
                runner: 'local',
                specs: ['./test/specs/**/*.js'],
                capabilities: [{
                    browserName: 'chrome'
                }],
                logLevel: 'info',
                services: ['chromedriver'],
                }
            `
            vi.mocked(fs.readFile).mockResolvedValue(mockConfig)
            vi.mocked(fs.writeFile).mockResolvedValue()

            // Act
            const result = await configModule.createTempConfigFile(filename, outDir)

            // Assert
            expect(fs.readFile).toHaveBeenCalledWith(filename, { encoding: 'utf8' })
            const writeFileCalls = vi.mocked(fs.writeFile).mock.calls
            expect(writeFileCalls.length).toBe(1)

            // Check that the output includes the reporter require
            const outputContent = writeFileCalls[0][1] as string

            // Check that reporters is added to config
            expect(outputContent).toMatchSnapshot()

            // Check the temp filename structure
            expect(result).toContain('wdio-vscode-')
            expect(result).toContain('.js')
        })

        // Test for module.exports format
        it('should add reporter to a config using module.exports', async () => {
            // Arrange
            const filename = 'wdio.conf.js'
            const outDir = '/output/dir'
            const mockConfig = `
        const path = require('path')

        module.exports = {
          runner: 'local',
          specs: ['./test/specs/**/*.js'],
          capabilities: [{
            browserName: 'chrome'
          }],
          logLevel: 'info',
        }
      `
            vi.mocked(fs.readFile).mockResolvedValue(mockConfig)
            vi.mocked(fs.writeFile).mockResolvedValue()

            // Act
            await configModule.createTempConfigFile(filename, outDir)

            // Assert
            const writeFileCalls = vi.mocked(fs.writeFile).mock.calls
            const outputContent = writeFileCalls[0][1] as string

            // Check that the reporter require is added
            expect(outputContent).toMatchSnapshot()
        })

        // Test when reporter import already exists
        it('should not add duplicate reporter import if already present in ESM', async () => {
            // Arrange
            const filename = 'wdio.conf.ts'
            const outDir = '/output/dir'
            const mockConfig = `
        import { defineConfig } from '@wdio/cli'
        import VscodeJsonReporter from "${reporterPathUrl}"

        export const config = defineConfig({
          runner: 'local',
          specs: ['./test/specs/**/*.ts'],
          capabilities: [{
            browserName: 'chrome'
          }],
        })
      `
            vi.mocked(fs.readFile).mockResolvedValue(mockConfig)
            vi.mocked(fs.writeFile).mockResolvedValue()

            // Act
            await configModule.createTempConfigFile(filename, outDir)

            // Assert
            const writeFileCalls = vi.mocked(fs.writeFile).mock.calls
            const outputContent = writeFileCalls[0][1] as string

            // Count occurrences of import statement
            const importMatches = outputContent.match(
                new RegExp(
                    `import VscodeJsonReporter from "${reporterPathUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`,
                    'g'
                )
            )
            expect(importMatches).toHaveLength(1)

            // Check that reporters is added to config
            expect(outputContent).toMatchSnapshot()
        })
    })
})
