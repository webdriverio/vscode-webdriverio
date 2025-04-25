import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { parseTestCases } from '../../../src/worker/parsers/js.js'

import type { TestData } from '../../../src/test/types.js'
import type { WorkerMetaContext } from '../../../src/worker/types.js'

// Mock vscode dependencies only
vi.mock('vscode', () => import('../../__mocks__/vscode.js'))

describe('Test Parser', () => {
    // Create mock WorkerMetaContext for the parseTestCases function
    const mockContext: WorkerMetaContext = {
        log: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    } as unknown as WorkerMetaContext

    // Sample test contents with different test patterns
    const basicTestContent = `
        describe('Basic Test Suite', () => {
            it('should test something', () => {
                expect(1).toBe(1);
            });

            test('testing with test function', () => {
                expect(true).toBeTruthy();
            });
        });
    `

    const nestedTestContent = `
        describe('Parent Suite', () => {
            describe('Child Suite', () => {
                it('nested test case', () => {
                    expect(true).toBeTruthy();
                });
            });

            it('parent-level test', () => {
                expect(1).toBe(1);
            });
        });
    `

    const testWithSkipAndOnly = `
        describe.skip('Skipped Suite', () => {
            it('will be skipped', () => {});
        });

        describe('Normal Suite', () => {
            it.only('only this will run', () => {});
        });
    `

    const testWithDynamicNames = `
        const prefix = 'Dynamic';
        describe(\`\${prefix} Suite\`, () => {
            it(prefix + ' test case', () => {});
            it(\`Template \${prefix} test\`, () => {});
        });
    `

    const testWithComplexContent = `
        import { expect } from 'vitest';

        // Using TypeScript features
        interface TestInterface {
            name: string;
            value: number;
        }

        describe('Complex TypeScript Test', () => {
            const testObj: TestInterface = {
                name: 'test',
                value: 42
            };

            it('should handle TypeScript correctly', () => {
                expect(testObj.name).toBe('test');
                expect(testObj.value).toBe(42);
            });

            // With arrow function
            it('works with arrow functions', async () => {
                const result = await Promise.resolve(true);
                expect(result).toBeTruthy();
            });
        });
    `

    const testWithInvalidSyntax = `
        describe('Invalid Test Suite', () => {
            it('has invalid syntax', () => {
                const x = {
                    // Missing closing brace
                    name: 'test'
            });
        });
    `

    beforeEach(() => {
        vi.resetAllMocks()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('parseTestCases', () => {
        it('should parse basic test cases correctly', () => {
            // Execute
            const testCases = parseTestCases.call(mockContext, basicTestContent, 'test-file.ts')

            // Verify
            expect(testCases.length).toBe(1)

            // Check the suite
            const suite = testCases[0]
            expect(suite.type).toBe('describe')
            expect(suite.name).toBe('Basic Test Suite')
            expect(suite.children.length).toBe(2)

            // Check the first test
            const firstTest = suite.children[0]
            expect(firstTest.type).toBe('it')
            expect(firstTest.name).toBe('should test something')
            expect(firstTest.children.length).toBe(0)

            // Check the second test
            const secondTest = suite.children[1]
            expect(secondTest.type).toBe('test')
            expect(secondTest.name).toBe('testing with test function')
            expect(secondTest.children.length).toBe(0)
        })

        it('should parse nested test suites correctly', () => {
            // Execute
            const testCases = parseTestCases.call(mockContext, nestedTestContent, 'nested-test.ts')

            // Verify
            expect(testCases.length).toBe(1)

            // Check parent suite
            const parentSuite = testCases[0]
            expect(parentSuite.type).toBe('describe')
            expect(parentSuite.name).toBe('Parent Suite')
            expect(parentSuite.children.length).toBe(2)

            // Check child suite
            const childSuite = parentSuite.children[0]
            expect(childSuite.type).toBe('describe')
            expect(childSuite.name).toBe('Child Suite')
            expect(childSuite.children.length).toBe(1)

            // Check nested test
            const nestedTest = childSuite.children[0]
            expect(nestedTest.type).toBe('it')
            expect(nestedTest.name).toBe('nested test case')

            // Check parent-level test
            const parentTest = parentSuite.children[1]
            expect(parentTest.type).toBe('it')
            expect(parentTest.name).toBe('parent-level test')
        })

        it('should handle test.skip and test.only syntax', () => {
            // Execute
            const testCases = parseTestCases.call(mockContext, testWithSkipAndOnly, 'skip-only-test.ts')

            // Verify
            expect(testCases.length).toBe(2)

            // Check skipped suite
            const skippedSuite = testCases[0]
            expect(skippedSuite.type).toBe('describe')
            expect(skippedSuite.name).toBe('Skipped Suite')

            // Check normal suite with only
            const normalSuite = testCases[1]
            expect(normalSuite.type).toBe('describe')
            expect(normalSuite.name).toBe('Normal Suite')
            expect(normalSuite.children.length).toBe(1)

            const onlyTest = normalSuite.children[0]
            expect(onlyTest.type).toBe('it')
            expect(onlyTest.name).toBe('only this will run')
        })

        it('should handle dynamic test names appropriately', () => {
            // Execute
            const testCases = parseTestCases.call(mockContext, testWithDynamicNames, 'dynamic-names.ts')

            // Verify
            expect(testCases.length).toBe(1)

            // Check suite with template literal
            const suite = testCases[0]
            expect(suite.type).toBe('describe')
            expect(suite.name).toBe('${...} Suite')
            expect(suite.children.length).toBe(2)

            // Check tests with dynamic names
            const test1 = suite.children[0]
            expect(test1.name).toContain('[dynamic]')

            const test2 = suite.children[1]
            expect(test2.name).toContain('Template')
            expect(test2.name).toContain('${...}')
        })

        it('should handle complex TypeScript syntax correctly', () => {
            // Execute
            const testCases = parseTestCases.call(mockContext, testWithComplexContent, 'complex-ts.ts')

            // Verify
            expect(testCases.length).toBe(1)

            // Check complex suite
            const suite = testCases[0]
            expect(suite.type).toBe('describe')
            expect(suite.name).toBe('Complex TypeScript Test')
            expect(suite.children.length).toBe(2)

            // Check test cases
            expect(suite.children[0].name).toBe('should handle TypeScript correctly')
            expect(suite.children[1].name).toBe('works with arrow functions')
        })

        it('should include proper source ranges for each test', () => {
            // Execute
            const testCases = parseTestCases.call(mockContext, basicTestContent, 'ranges-test.ts')

            // Verify all test cases have range information
            function verifyRanges(testCase: TestData) {
                expect(testCase.range).toBeDefined()
                expect(testCase.range.start).toBeDefined()
                expect(testCase.range.end).toBeDefined()
                expect(typeof testCase.range.start.line).toBe('number')
                expect(typeof testCase.range.start.column).toBe('number')
                expect(typeof testCase.range.end.line).toBe('number')
                expect(typeof testCase.range.end.column).toBe('number')

                // Verify line and column are logical
                expect(testCase.range.start.line).toBeLessThanOrEqual(testCase.range.end.line)
                if (testCase.range.start.line === testCase.range.end.line) {
                    expect(testCase.range.start.column).toBeLessThan(testCase.range.end.column)
                }

                // Verify all children have ranges too
                testCase.children.forEach(verifyRanges)
            }

            testCases.forEach(verifyRanges)
        })

        it('should throw an error with invalid syntax', () => {
            // Execute & Verify
            expect(() => parseTestCases.call(mockContext, testWithInvalidSyntax, 'invalid-test.ts')).toThrow(
                'Failed to parse test file invalid-test.ts'
            )
        })

        it('should log debug information', () => {
            // Execute
            parseTestCases.call(mockContext, basicTestContent, 'test-file.ts')

            // Verify debug log was called
            expect(mockContext.log.debug).toHaveBeenCalledWith('Javascript/Typescript parser is used.')
        })
    })
})
