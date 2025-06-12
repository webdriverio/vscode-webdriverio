import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { parse } from '../../src/parsers/index.js'
import { parseWithWdio } from '../../src/parsers/parser.js'
import { getCucumberParser, type CucumberParser } from '../../src/parsers/utils.js'
import type { ReadSpecsOptions } from '@vscode-wdio/types/api'
import type { WorkerMetaContext, TestData, CucumberTestData } from '@vscode-wdio/types/worker'

// Import the types
// Mock fs module
vi.mock('node:fs/promises', () => ({
    readFile: vi.fn(),
}))

// Mock the parsers

vi.mock('../../src/parsers/parser.js', () => ({
    parseWithWdio: vi.fn(),
}))

vi.mock('../../src/parsers/utils.js', () => ({
    getCucumberParser: vi.fn(),
}))

// Import mocked modules

describe('Parser Index', () => {
    // Create mock context
    const mockContext: WorkerMetaContext = {
        log: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    } as unknown as WorkerMetaContext

    // Sample file contents
    const jsTestContent = 'describe("Test Suite", () => { it("should work", () => {}) })'
    const cucumberFeatureContent = 'Feature: Test Feature\nScenario: Test Scenario\nGiven a step'

    // Sample test data results
    const jsMockTestData: TestData[] = [
        {
            type: 'describe',
            name: 'Test Suite',
            range: { start: { line: 0, column: 0 }, end: { line: 0, column: 10 } },
            children: [
                {
                    type: 'it',
                    name: 'should work',
                    range: { start: { line: 0, column: 0 }, end: { line: 0, column: 10 } },
                    children: [],
                },
            ],
        },
    ]

    const cucumberMockTestData: CucumberTestData[] = [
        {
            type: 'feature',
            name: 'Test Feature',
            range: { start: { line: 0, column: 0 }, end: { line: 2, column: 10 } },
            children: [
                {
                    type: 'scenario',
                    name: 'Test Scenario',
                    range: { start: { line: 1, column: 0 }, end: { line: 2, column: 10 } },
                    children: [
                        {
                            type: 'step',
                            name: 'Given a step',
                            range: { start: { line: 2, column: 0 }, end: { line: 2, column: 10 } },
                            children: [],
                            metadata: {
                                stepType: 'Given',
                            },
                        },
                    ],
                    metadata: {},
                },
            ],
            metadata: {},
        },
    ]

    const cucumberParser: CucumberParser = vi.fn(() => cucumberMockTestData)

    beforeEach(() => {
        vi.resetAllMocks()

        // Mock the parseWithWdio and cucumberParser functions
        const testMap = new Map()
        vi.mocked(parseWithWdio).mockResolvedValue(testMap.set('/path/to/test.js', jsMockTestData))
        vi.mocked(getCucumberParser).mockResolvedValue(cucumberParser)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('parse', () => {
        it('should parse JavaScript test files correctly', async () => {
            // Setup
            const options: ReadSpecsOptions = {
                framework: 'mocha',
                wdioConfigPath: '/path/to/wdio.conf.js',
                specs: ['/path/to/test.js'],
            }

            // Mock fs.readFile to return JS test content
            vi.mocked(fs.readFile).mockResolvedValue(jsTestContent)

            // Execute
            const result = await parse.call(mockContext, options)

            // Verify
            expect(result.length).toBe(1)
            expect(result[0].spec).toBe(path.normalize('/path/to/test.js'))
            expect(result[0].tests).toEqual(jsMockTestData)

            // Verify the correct parser was called
            expect(parseWithWdio).toHaveBeenCalledWith(mockContext, options)
            expect(cucumberParser).not.toHaveBeenCalled()

            // Verify logging
            expect(mockContext.log.debug).toHaveBeenCalledWith(`Parse spec file: ${path.normalize('/path/to/test.js')}`)
            expect(mockContext.log.debug).toHaveBeenCalledWith(
                `Successfully parsed: ${path.normalize('/path/to/test.js')}`
            )
        })

        it('should parse TypeScript test files correctly', async () => {
            // Setup
            const options: ReadSpecsOptions = {
                framework: 'mocha',
                wdioConfigPath: '/path/to/wdio.conf.js',
                specs: ['/path/to/test.js'],
            }

            // Mock fs.readFile to return JS test content
            vi.mocked(fs.readFile).mockResolvedValue(jsTestContent)

            // Execute
            const result = await parse.call(mockContext, options)

            // Verify
            expect(result.length).toBe(1)
            expect(result[0].spec).toBe(path.normalize('/path/to/test.js'))
            expect(result[0].tests).toEqual(jsMockTestData)

            // Verify the correct parser was called
            expect(parseWithWdio).toHaveBeenCalledWith(mockContext, options)
            expect(cucumberParser).not.toHaveBeenCalled()
        })

        it('should parse Cucumber feature files correctly', async () => {
            // Setup
            const options: ReadSpecsOptions = {
                framework: 'cucumber',
                wdioConfigPath: '/path/to/wdio.conf.js',
                specs: ['/path/to/test.feature'],
            }

            // Mock fs.readFile to return Cucumber feature content
            vi.mocked(fs.readFile).mockResolvedValue(cucumberFeatureContent)

            // Execute
            const result = await parse.call(mockContext, options)

            // Verify
            expect(result.length).toBe(1)
            expect(result[0].spec).toBe(path.normalize('/path/to/test.feature'))
            expect(result[0].tests).toEqual(cucumberMockTestData)

            // Verify the correct parser was called
            expect(cucumberParser).toHaveBeenCalledWith(cucumberFeatureContent, path.normalize('/path/to/test.feature'))
            expect(parseWithWdio).not.toHaveBeenCalled()
        })

        it('should handle uppercase feature file extensions', async () => {
            // Setup
            const options: ReadSpecsOptions = {
                framework: 'cucumber',
                wdioConfigPath: '/path/to/wdio.conf.js',
                specs: ['/path/to/test.FEATURE'],
            }

            // Mock fs.readFile to return Cucumber feature content
            vi.mocked(fs.readFile).mockResolvedValue(cucumberFeatureContent)

            // Execute
            const result = await parse.call(mockContext, options)

            // Verify
            expect(result.length).toBe(1)
            expect(result[0].spec).toBe(path.normalize('/path/to/test.FEATURE'))
            expect(result[0].tests).toEqual(cucumberMockTestData)

            // Verify the correct parser was called
            expect(cucumberParser).toHaveBeenCalledWith(cucumberFeatureContent, path.normalize('/path/to/test.FEATURE'))
            expect(parseWithWdio).not.toHaveBeenCalled()
        })

        it('should handle file reading errors', async () => {
            // Setup
            const options: ReadSpecsOptions = {
                framework: 'mocha',
                wdioConfigPath: '/path/to/wdio.conf.js',
                specs: ['/path/to/test.js'],
            }

            // Mock fs.readFile to throw an error
            const mockError = new Error('File not found')
            vi.mocked(fs.readFile).mockRejectedValue(mockError)

            // Execute & Verify
            await expect(parse.call(mockContext, options)).rejects.toThrow('File not found')
        })

        it('should normalize file paths', async () => {
            // Setup
            const options: ReadSpecsOptions = {
                framework: 'mocha',
                wdioConfigPath: 'C:\\path\\to\\wdio.conf.js',
                specs: ['C:\\path\\to\\test.js'], // Windows style path
            }

            // Mock fs.readFile to return JS test content
            vi.mocked(fs.readFile).mockResolvedValue(jsTestContent)

            // Execute
            const result = await parse.call(mockContext, options)

            // Verify the path is normalized
            expect(result[0].spec).toBe(path.normalize('C:\\path\\to\\test.js'))

            // Verify the parser was called with the normalized path
            expect(parseWithWdio).toHaveBeenCalledWith(mockContext, options)
        })

        it('should handle empty specs array', async () => {
            // Setup
            const options: ReadSpecsOptions = {
                framework: 'mocha',
                wdioConfigPath: '/path/to/wdio.conf.js',
                specs: [],
            }

            // Execute
            const result = await parse.call(mockContext, options)

            // Verify
            expect(result).toEqual([])
            expect(fs.readFile).not.toHaveBeenCalled()
            expect(parseWithWdio).not.toHaveBeenCalled()
            expect(cucumberParser).not.toHaveBeenCalled()
        })
    })
})
