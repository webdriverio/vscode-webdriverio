import { join } from 'node:path'

import * as chai from 'chai'
import * as vscode from 'vscode'

import { convertTestData, convertPathToUri, isCucumberFeatureFile, convertUriToPath } from '../../src/test/converter.js'
import type { ReadSpecsResult } from '../../src/api/index.js'

const expect = chai.expect

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

            // Expectations
            expect(result).to.be.an('array').with.lengthOf(1)
            expect(result[0].type).to.equal('describe')
            expect(result[0].name).to.equal('Root describe')
            expect(result[0].uri.fsPath).to.equal(vscode.Uri.file(specFilePath).fsPath)
            expect(result[0].range).to.be.an.instanceOf(vscode.Range)
            expect(result[0].range.start.line).to.equal(0)
            expect(result[0].range.start.character).to.equal(0)
            expect(result[0].range.end.line).to.equal(10)
            expect(result[0].range.end.character).to.equal(1)

            // Check children
            expect(result[0].children).to.be.an('array').with.lengthOf(1)
            expect(result[0].children[0].type).to.equal('it')
            expect(result[0].children[0].name).to.equal('Child test')
            expect(result[0].children[0].range.start.line).to.equal(2)
            expect(result[0].children[0].range.start.character).to.equal(4)
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
                expect(error).to.be.an.instanceOf(Error)
                expect((error as Error).message).to.include('Failed to parse or adapt test cases')
            }
        })
    })

    describe('convertPathToUri', () => {
        it('should convert file path to VSCode URI', () => {
            const filePath = join(process.cwd(), 'path', 'to', 'spec.js')
            const result = convertPathToUri(filePath)

            expect(result).to.be.an.instanceOf(vscode.Uri)
            expect(result.scheme).to.equal('file')
            expect(result.fsPath).to.equal(vscode.Uri.file(filePath).fsPath)
        })
    })

    describe('convertUriToPath', () => {
        it('should convert file path to VSCode URI - Windows', () => {
            const filePath = join(process.cwd(), 'path', 'to', 'spec.js')
            const uri = vscode.Uri.file(filePath)
            const result = convertUriToPath(uri)

            expect(result).to.equal(filePath)
            if (process.platform === 'win32') {
                expect(filePath).to.match(/^([A-Z]):/)
                expect(result).to.match(/^([A-Z]):/)
            }
        })
    })

    describe('isCucumberFeatureFile', () => {
        it('should return true for .feature files', () => {
            expect(isCucumberFeatureFile('/path/to/test.feature')).to.be.true
            expect(isCucumberFeatureFile('/path/to/TEST.FEATURE')).to.be.true
            expect(isCucumberFeatureFile('test.feature')).to.be.true
        })

        it('should return false for non-feature files', () => {
            expect(isCucumberFeatureFile('/path/to/test.js')).to.be.false
            expect(isCucumberFeatureFile('/path/to/test.ts')).to.be.false
            expect(isCucumberFeatureFile('/path/to/test.featurex')).to.be.false
            expect(isCucumberFeatureFile('/path/to/test')).to.be.false
        })
    })
})
