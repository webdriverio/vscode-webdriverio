import { join } from 'node:path'

import { describe, it, expect, vi } from 'vitest'
import * as vscode from 'vscode'

import { convertPathToUri, convertTestData, isCucumberFeatureFile } from '../src/converter.js'
import type { ReadSpecsResult } from '@vscode-wdio/types/server'

// Mock dependencies
vi.mock('vscode', () => import('../../../tests/__mocks__/vscode.cjs'))
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

describe('Converter', () => {
    describe('convertTestData', () => {
        it('should convert parser test data to VSCode test data format', async () => {
            // Mock test data
            const specFilePath = join(process.cwd(), 'path', 'to', 'spec.js')
            const mockTestData: ReadSpecsResult = {
                spec: specFilePath,
                tests: [
                    {
                        type: 'describe',
                        name: 'Root describe',
                        range: {
                            start: { line: 0, column: 0 },
                            end: { line: 10, column: 1 },
                        },
                        children: [
                            {
                                type: 'it',
                                name: 'Child test',
                                range: {
                                    start: { line: 2, column: 4 },
                                    end: { line: 4, column: 5 },
                                },
                                children: [],
                            },
                        ],
                    },
                ],
            }

            // Expected result
            const result = await convertTestData(mockTestData)
            expect(result.length).toBe(1)
            expect(result[0].type).toBe('describe')
            expect(result[0].name).toBe('Root describe')
            expect(result[0].uri.fsPath).toBe(vscode.Uri.file(specFilePath).fsPath)
            expect(result[0].range).toBeInstanceOf(vscode.Range)
            expect(result[0].range.start.line).toBe(0)
            expect(result[0].range.start.character).toBe(0)
            expect(result[0].range.end.line).toBe(10)
            expect(result[0].range.end.character).toBe(1)

            // Check children
            expect(result[0].children.length).toBe(1)
            expect(result[0].children[0].type).toBe('it')
            expect(result[0].children[0].name).toBe('Child test')
            expect(result[0].children[0].range.start.line).toBe(2)
            expect(result[0].children[0].range.start.character).toBe(4)
        })

        it('should throw an error when parsing fails', async () => {
            // Setup test to fail
            const mockTestData = {
                spec: '/path/to/spec.js',
                tests: null,
            } as any

            // Test error handling
            try {
                await convertTestData(mockTestData)
                expect.fail('Expected convertTestData to throw an error')
            } catch (error) {
                expect(error).toBeInstanceOf(Error)
                expect((error as Error).message).to.include('Failed to parse or adapt test cases')
            }
        })
    })

    describe('convertPathToUri', () => {
        it('should convert file path to VSCode URI', () => {
            const filePath = join(process.cwd(), 'path', 'to', 'spec.js')
            const result = convertPathToUri(filePath)

            expect(result.scheme).toEqual('file')
            expect(result.fsPath).toEqual(vscode.Uri.file(filePath).fsPath)
        })
    })

    describe('isCucumberFeatureFile', () => {
        it('should return true for .feature files', () => {
            expect(isCucumberFeatureFile('/path/to/test.feature')).toBe(true)
            expect(isCucumberFeatureFile('/path/to/TEST.FEATURE')).toBe(true)
            expect(isCucumberFeatureFile('test.feature')).toBe(true)
        })

        it('should return false for non-feature files', () => {
            expect(isCucumberFeatureFile('/path/to/test.js')).toBe(false)
            expect(isCucumberFeatureFile('/path/to/test.ts')).toBe(false)
            expect(isCucumberFeatureFile('/path/to/test.featurex')).toBe(false)
            expect(isCucumberFeatureFile('/path/to/test')).toBe(false)
        })
    })
})
