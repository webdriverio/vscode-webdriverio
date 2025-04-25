import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Import parse function from parsers
import { parseCucumberFeature } from '../../../src/worker/parsers/cucumber.js'
import { parse } from '../../../src/worker/parsers/index.js'
import { parseTestCases } from '../../../src/worker/parsers/js.js'

// Import the types
import type { ReadSpecsOptions } from '../../../src/api/index.js'
import type { WorkerMetaContext } from '../../../src/worker/types.js'
import type { TestData, CucumberTestData } from '../../../src/worker/types.js'

// Mock fs module
vi.mock('node:fs/promises', () => ({
    readFile: vi.fn(),
}))

// Mock the parsers
vi.mock('../../../src/worker/parsers/cucumber.js', () => ({
    parseCucumberFeature: vi.fn(),
}))

vi.mock('../../../src/worker/parsers/js.js', () => ({
    parseTestCases: vi.fn(),
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

    beforeEach(() => {
        vi.resetAllMocks()

        // Mock the parseTestCases and parseCucumberFeature functions
        vi.mocked(parseTestCases).mockReturnValue(jsMockTestData)
        vi.mocked(parseCucumberFeature).mockReturnValue(cucumberMockTestData)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('parse', () => {
        it('should parse JavaScript test files correctly', async () => {
            // Setup
            const options: ReadSpecsOptions = {
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
            expect(parseTestCases).toHaveBeenCalledWith(jsTestContent, path.normalize('/path/to/test.js'))
            expect(parseCucumberFeature).not.toHaveBeenCalled()

            // Verify logging
            expect(mockContext.log.debug).toHaveBeenCalledWith(`Parse spec file: ${path.normalize('/path/to/test.js')}`)
            expect(mockContext.log.debug).toHaveBeenCalledWith(
                `Successfully parsed: ${path.normalize('/path/to/test.js')}`
            )
        })

        it('should parse TypeScript test files correctly', async () => {
            // Setup
            const options: ReadSpecsOptions = {
                specs: ['/path/to/test.ts'],
            }

            // Mock fs.readFile to return JS test content
            vi.mocked(fs.readFile).mockResolvedValue(jsTestContent)

            // Execute
            const result = await parse.call(mockContext, options)

            // Verify
            expect(result.length).toBe(1)
            expect(result[0].spec).toBe(path.normalize('/path/to/test.ts'))
            expect(result[0].tests).toEqual(jsMockTestData)

            // Verify the correct parser was called
            expect(parseTestCases).toHaveBeenCalledWith(jsTestContent, path.normalize('/path/to/test.ts'))
            expect(parseCucumberFeature).not.toHaveBeenCalled()
        })

        it('should parse Cucumber feature files correctly', async () => {
            // Setup
            const options: ReadSpecsOptions = {
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
            expect(parseCucumberFeature).toHaveBeenCalledWith(
                cucumberFeatureContent,
                path.normalize('/path/to/test.feature')
            )
            expect(parseTestCases).not.toHaveBeenCalled()
        })

        it('should handle uppercase feature file extensions', async () => {
            // Setup
            const options: ReadSpecsOptions = {
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
            expect(parseCucumberFeature).toHaveBeenCalledWith(
                cucumberFeatureContent,
                path.normalize('/path/to/test.FEATURE')
            )
            expect(parseTestCases).not.toHaveBeenCalled()
        })

        it('should parse multiple spec files', async () => {
            // Setup
            const options: ReadSpecsOptions = {
                specs: ['/path/to/test.js', '/path/to/test.feature'],
            }

            // Mock fs.readFile to return appropriate content based on file extension
            vi.mocked(fs.readFile).mockImplementation((filePath) => {
                const pathString = String(filePath)
                if (pathString.endsWith('.feature')) {
                    return Promise.resolve(cucumberFeatureContent)
                }
                return Promise.resolve(jsTestContent)
            })

            // Execute
            const result = await parse.call(mockContext, options)

            // Verify
            expect(result.length).toBe(2)

            // Check JS test results
            expect(result[0].spec).toBe(path.normalize('/path/to/test.js'))
            expect(result[0].tests).toEqual(jsMockTestData)

            // Check Cucumber feature results
            expect(result[1].spec).toBe(path.normalize('/path/to/test.feature'))
            expect(result[1].tests).toEqual(cucumberMockTestData)

            // Verify the correct parsers were called
            expect(parseTestCases).toHaveBeenCalledWith(jsTestContent, path.normalize('/path/to/test.js'))
            expect(parseCucumberFeature).toHaveBeenCalledWith(
                cucumberFeatureContent,
                path.normalize('/path/to/test.feature')
            )
        })

        it('should handle file reading errors', async () => {
            // Setup
            const options: ReadSpecsOptions = {
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
                specs: ['C:\\path\\to\\test.js'], // Windows style path
            }

            // Mock fs.readFile to return JS test content
            vi.mocked(fs.readFile).mockResolvedValue(jsTestContent)

            // Execute
            const result = await parse.call(mockContext, options)

            // Verify the path is normalized
            expect(result[0].spec).toBe(path.normalize('C:\\path\\to\\test.js'))

            // Verify the parser was called with the normalized path
            expect(parseTestCases).toHaveBeenCalledWith(jsTestContent, path.normalize('C:\\path\\to\\test.js'))
        })

        it('should handle empty specs array', async () => {
            // Setup
            const options: ReadSpecsOptions = {
                specs: [],
            }

            // Execute
            const result = await parse.call(mockContext, options)

            // Verify
            expect(result).toEqual([])
            expect(fs.readFile).not.toHaveBeenCalled()
            expect(parseTestCases).not.toHaveBeenCalled()
            expect(parseCucumberFeature).not.toHaveBeenCalled()
        })
    })
})
