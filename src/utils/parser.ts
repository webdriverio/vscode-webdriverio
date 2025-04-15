import * as vscode from 'vscode'
import { parse, types } from 'recast'
import * as babelParser from '@babel/parser'
import * as t from '@babel/types'

/**
 * TestCase information interface - Keeping the same structure as original
 */
export interface TestCaseInfo {
    type: 'describe' | 'it' | 'test'
    name: string
    range: vscode.Range
    children: TestCaseInfo[]
}

/**
 * Parse WebDriverIO test files and extract test cases using Recast and Babel parser
 * This version maintains the same interface as the original parseTestCases function
 * but implements the parser using Recast and Babel for TypeScript support
 *
 * @param fileContent Content of the test file
 * @param document VSCode TextDocument object
 * @returns Array of test case information
 */
export function parseTestCases(fileContent: string, document: vscode.TextDocument): TestCaseInfo[] {
    // Set up a list to store all test cases
    const testCases: TestCaseInfo[] = []

    // Track each test block for building the hierarchy
    const testBlocksMap = new Map<string, TestCaseInfo>()

    try {
        // Parse the file content with Recast and Babel parser to handle TypeScript
        const ast = parse(fileContent, {
            parser: {
                parse: (source: string) => {
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
                },
            },
        })

        // Process the AST to extract test blocks
        processAst(ast, document, testCases, testBlocksMap)
    } catch (error) {
        console.error('Failed to parse test file:', error)
        // Fallback to simple regex-based extraction if parsing fails
        return fallbackParseTestCases(fileContent, document)
    }
    return testCases
}

/**
 * Process the AST to find and extract test blocks
 *
 * @param ast The parsed AST
 * @param document VSCode document for position conversion
 * @param testCases Array to store top-level test cases
 * @param testBlocksMap Map to track all test blocks for hierarchy building
 */
function processAst(
    ast: any,
    document: vscode.TextDocument,
    testCases: TestCaseInfo[],
    testBlocksMap: Map<string, TestCaseInfo>
): void {
    // Stack to track current describe block context
    const blockStack: TestCaseInfo[] = []
    const brockIdSet = new Set<string>()

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
                        // Create range in the document
                        const range = nodeToRange(node, document)

                        // Create test case info
                        const testCase: TestCaseInfo = {
                            type: blockType,
                            name: testName,
                            range,
                            children: [],
                        }

                        // Generate a unique ID for this test block
                        const blockId = `${blockType}:${range.start.line}:${range.start.character}`
                        if (!brockIdSet.has(blockId)) {
                            brockIdSet.add(blockId)
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

                            // Find the function body in the second argument
                            const callbackArg = node.arguments[1] as t.Node
                            if (
                                !!callbackArg &&
                                (t.isArrowFunctionExpression(callbackArg) || t.isFunctionExpression(callbackArg))
                            ) {
                                const body = callbackArg.body

                                // For arrow functions with expression body, we don't traverse
                                if (t.isBlockStatement(body)) {
                                    // For block statements, traverse the body
                                    this.traverse(path.get('arguments', 1))
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

            // Continue traversal for other nodes
            this.traverse(path)

            return false
        },
    })
}

/**
 * Check if a node is a test block call (describe, it, or test)
 *
 * @param node The AST node to check
 * @returns True if node is a test block call
 */
function isTestBlockCall(node: any): boolean {
    return (
        t.isIdentifier(node.callee) &&
        (node.callee.name === 'describe' || node.callee.name === 'it' || node.callee.name === 'test')
    )
}

/**
 * Get the type of test block (describe, it, or test)
 *
 * @param node The AST node
 * @returns The test block type or null if not a test block
 */
function getTestBlockType(node: any): 'describe' | 'it' | 'test' | null {
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
    }
    return null
}

/**
 * Extract test name from the first argument of a test block
 * Handles various string formats (literals, template literals, concatenations)
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
        }
    }

    return null
}

/**
 * Convert an AST node to a VSCode range
 *
 * @param node The AST node
 * @param document VSCode document for position conversion
 * @returns VSCode range object
 */
function nodeToRange(node: any, document: vscode.TextDocument): vscode.Range {
    const start = document.positionAt(node.start)
    const end = document.positionAt(node.end)
    return new vscode.Range(start, end)
}

/**
 * Fallback parser that uses regex to extract test cases when AST parsing fails
 *
 * @param fileContent Content of the test file
 * @param document VSCode document for position conversion
 * @returns Array of test case information
 */
function fallbackParseTestCases(fileContent: string, document: vscode.TextDocument): TestCaseInfo[] {
    const testCases: TestCaseInfo[] = []

    // Remove comments to avoid false positives
    const contentWithoutComments = fileContent.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//gm, '')

    // Find describe blocks
    const describeRegex =
        /\bdescribe\s*\(\s*(['"`])((?:(?!\1).|\\.)*)\1\s*,\s*(?:function\s*\([^)]*\)|(?:\([^)]*\)\s*=>))/g
    let describeMatch

    while ((describeMatch = describeRegex.exec(contentWithoutComments)) !== null) {
        const describeName = describeMatch[2]
        const startPos = document.positionAt(describeMatch.index)
        const endPos = document.positionAt(describeMatch.index + describeMatch[0].length)

        // Find closing bracket for this describe block
        const blockStart = describeMatch.index + describeMatch[0].length
        let blockEnd = findClosingBracket(contentWithoutComments, blockStart)
        if (blockEnd === -1) {
            blockEnd = contentWithoutComments.length
        }

        // Extract content of this describe block
        const blockContent = contentWithoutComments.substring(blockStart, blockEnd)

        // Find it blocks within this describe
        const itBlocks = findItBlocks(blockContent, document, blockStart)

        // Create describe test case
        const describeCase: TestCaseInfo = {
            type: 'describe',
            name: describeName,
            range: new vscode.Range(startPos, endPos),
            children: itBlocks,
        }

        testCases.push(describeCase)
    }

    // Find top-level it blocks
    const topLevelIt = findItBlocks(contentWithoutComments, document, 0)

    // Filter out it blocks that are already within describe blocks
    const itInDescribe = new Set<number>()
    testCases.forEach((describe) => {
        describe.children.forEach((it) => {
            itInDescribe.add(it.range.start.line)
        })
    })

    // Add it blocks that aren't in any describe
    topLevelIt.forEach((it) => {
        if (!itInDescribe.has(it.range.start.line)) {
            testCases.push(it)
        }
    })

    return testCases
}

/**
 * Find it/test blocks in the content
 *
 * @param content Content to search in
 * @param document VSCode document
 * @param startOffset Starting offset in the document
 * @returns Array of it/test blocks
 */
function findItBlocks(content: string, document: vscode.TextDocument, startOffset: number): TestCaseInfo[] {
    const itBlocks: TestCaseInfo[] = []

    // Regex for it blocks
    const itRegex = /\b(it|test)\s*\(\s*(['"`])((?:(?!\2).|\\.)*)\2\s*,\s*(?:function\s*\([^)]*\)|(?:\([^)]*\)\s*=>))/g
    let itMatch

    while ((itMatch = itRegex.exec(content)) !== null) {
        const itType = itMatch[1] as 'it' | 'test'
        const itName = itMatch[3]
        const startPos = document.positionAt(startOffset + itMatch.index)
        const endPos = document.positionAt(startOffset + itMatch.index + itMatch[0].length)

        itBlocks.push({
            type: itType,
            name: itName,
            range: new vscode.Range(startPos, endPos),
            children: [],
        })
    }

    return itBlocks
}

/**
 * Find the position of the closing bracket that matches the opening bracket after startPos
 *
 * @param content Content to search in
 * @param startPos Position after the opening bracket
 * @returns Position of the matching closing bracket or -1 if not found
 */
function findClosingBracket(content: string, startPos: number): number {
    let depth = 1
    let inString = false
    let stringChar = ''
    let escaped = false

    for (let i = startPos; i < content.length; i++) {
        const char = content[i]

        if (!inString) {
            if (char === '{') {
                depth++
            } else if (char === '}') {
                depth--
                if (depth === 0) {
                    return i
                }
            } else if (char === "'" || char === '"' || char === '`') {
                inString = true
                stringChar = char
            }
        } else if (!escaped && char === stringChar) {
            inString = false
        }

        escaped = char === '\\' && !escaped
    }

    return -1
}
