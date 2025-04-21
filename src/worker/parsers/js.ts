import * as babelParser from '@babel/parser'
import * as t from '@babel/types'
import { parse, types } from 'recast'

import type { TestData, SourceRange, WorkerMetaContext } from '../types.js'

/**
 * Parse WebDriverIO test files and extract test cases using Recast and Babel parser
 *
 * @param fileContent Content of the test file
 * @param uri File URI for error reporting
 * @returns Array of test case information
 * @throws Error if parsing fails
 */
export function parseTestCases(this: WorkerMetaContext, fileContent: string, uri: string) {
    this.log.debug('Javascript/Typescript parser is used.')
    // Set up a list to store all test cases
    const testCases: TestData[] = []

    // Track each test block for building the hierarchy
    const testBlocksMap = new Map<string, TestData>()

    try {
        // Parse the file content with Recast and Babel parser to handle TypeScript
        const ast = parse(fileContent, {
            parser: {
                parse: (source: string) => {
                    try {
                        return babelParser.parse(source, {
                            sourceType: 'module',
                            plugins: [
                                'typescript',
                                'jsx',
                                'decorators-legacy',
                                'classProperties',
                                'exportDefaultFrom',
                                'exportNamespaceFrom',
                                'dynamicImport',
                                'objectRestSpread',
                                'optionalChaining',
                                'nullishCoalescingOperator',
                            ],
                            tokens: true,
                            ranges: true,
                        })
                    } catch (parseError) {
                        // Provide more detailed error information
                        const errorMessage = (parseError as Error).message
                        throw new Error(`Babel parser error: ${errorMessage}`)
                    }
                },
            },
        })

        // Process the AST to extract test blocks
        processAst(ast, testCases, testBlocksMap)
    } catch (error) {
        throw new Error(`Failed to parse test file ${uri}: ${(error as Error).message}`)
    }
    return testCases
}

/**
 * Process the AST to find and extract test blocks
 *
 * @param ast The parsed AST
 * @param testCases Array to store top-level test cases
 * @param testBlocksMap Map to track all test blocks for hierarchy building
 */
function processAst(ast: any, testCases: TestData[], testBlocksMap: Map<string, TestData>): void {
    // Stack to track current describe block context
    const blockStack: TestData[] = []
    const blockIdSet = new Set<string>()

    // Traverse the AST
    types.visit(ast, {
        // Visit call expressions to find describe, it, and test blocks
        visitCallExpression(path) {
            const node = path.node

            // Check if this is a test block call (describe, it, or test)
            if (isTestBlockCall(node)) {
                const blockType = getTestBlockType(node)

                if (blockType) {
                    // Extract the test name from the first argument
                    const testName = extractTestName(node.arguments[0])

                    if (testName) {
                        // Create source range using node offsets
                        const range = createSourceRange(node)

                        // Create test case info
                        const testCase: TestData = {
                            type: blockType,
                            name: testName,
                            range,
                            children: [],
                        }

                        // Generate a unique ID for this test block
                        // @ts-ignore
                        const blockId = `${blockType}:${node.start}:${node.end}`
                        if (!blockIdSet.has(blockId)) {
                            blockIdSet.add(blockId)
                            testBlocksMap.set(blockId, testCase)

                            // Add the test case to the current parent or to the top level
                            if (blockStack.length > 0) {
                                // Add to current parent in the stack
                                const parent = blockStack[blockStack.length - 1]
                                parent.children.push(testCase)
                            } else {
                                // Add to top level
                                testCases.push(testCase)
                            }
                        }

                        if (blockType === 'describe') {
                            // Push this describe block to the stack before processing its children
                            blockStack.push(testCase)

                            // Process the describe block's children
                            // Find the function body in the second argument
                            const callbackArg = node.arguments[1]
                            if (callbackArg) {
                                // Handle both regular and async functions
                                // @ts-ignore
                                if (t.isArrowFunctionExpression(callbackArg) || t.isFunctionExpression(callbackArg)) {
                                    const body = callbackArg.body

                                    // For arrow functions with expression body, we don't traverse
                                    if (t.isBlockStatement(body)) {
                                        // For block statements, traverse the body
                                        this.traverse(path.get('arguments', 1))
                                    }
                                }
                            }

                            // Pop this describe block after processing its children
                            blockStack.pop()
                        }
                        // Note: For 'it' and 'test' blocks, we just add them to the current parent
                        // but don't push them to the stack since they don't contain other tests
                    }
                }
            }

            // Continue traversal
            this.traverse(path)

            return false
        },
    })
}

/**
 * Create a SourceRange from an AST node
 *
 * @param node The AST node
 * @returns SourceRange with start and end offsets
 */
function createSourceRange(node: any): SourceRange {
    return {
        start: { offset: node.start },
        end: { offset: node.end },
    }
}

/**
 * Check if a node is a test block call (describe, it, or test)
 * Also handles method chains like describe.skip, it.only, etc.
 *
 * @param node The AST node to check
 * @returns True if node is a test block call
 */
function isTestBlockCall(node: any): boolean {
    // Direct call (describe, it, test)
    if (t.isIdentifier(node.callee) && ['describe', 'it', 'test'].includes(node.callee.name)) {
        return true
    }

    // Method chain call (describe.skip, it.only, etc.)
    if (
        t.isMemberExpression(node.callee) &&
        t.isIdentifier(node.callee.object) &&
        ['describe', 'it', 'test'].includes(node.callee.object.name)
    ) {
        return true
    }

    return false
}

/**
 * Get the type of test block (describe, it, or test)
 * Handles both direct calls and method chain calls
 *
 * @param node The AST node
 * @returns The test block type or null if not a test block
 */
function getTestBlockType(node: any): 'describe' | 'it' | 'test' | null {
    // Direct call
    if (t.isIdentifier(node.callee)) {
        if (node.callee.name === 'describe') {
            return 'describe'
        }
        if (node.callee.name === 'it') {
            return 'it'
        }
        if (node.callee.name === 'test') {
            return 'test'
        }
    } else if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.object)) {
        // Method chain call (e.g., describe.skip, it.only)

        if (node.callee.object.name === 'describe') {
            return 'describe'
        }
        if (node.callee.object.name === 'it') {
            return 'it'
        }
        if (node.callee.object.name === 'test') {
            return 'test'
        }
    }

    return null
}

/**
 * Extract test name from the first argument of a test block
 * Handles various string formats and provides placeholders for dynamic content
 *
 * @param node The AST node containing the test name
 * @returns The extracted test name or null if invalid
 */
function extractTestName(node: any): string | null {
    if (!node) {
        return null
    }

    // String literal
    if (t.isStringLiteral(node)) {
        return node.value
    }

    // Template literal
    if (t.isTemplateLiteral(node)) {
        return node.quasis.map((q) => q.value.cooked).join('${...}')
    }

    // Binary expression (string concatenation)
    if (t.isBinaryExpression(node) && node.operator === '+') {
        const left = extractTestName(node.left)
        const right = extractTestName(node.right)

        if (left !== null && right !== null) {
            return left + right
        } else if (left !== null) {
            return left + '...'
        } else if (right !== null) {
            return '...' + right
        }
    }

    // For dynamic content (variables, function calls, etc.)
    return '[dynamic]'
}
