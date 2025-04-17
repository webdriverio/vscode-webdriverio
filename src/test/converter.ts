// src/test/adapter.ts
import * as vscode from 'vscode'
import { parseTestCases } from './parser.js'
import type { TestData, SourceRange, VscodeTestData } from './types.js'

/**
 * Convert the parser's TestData to VSCode compatible TestData
 *
 * @param testCases Array of TestData from the parser
 * @param document VSCode document for position conversion
 * @returns Array of VscodeTestData
 */
function convertTestData(testCases: TestData[], document: vscode.TextDocument): VscodeTestData[] {
    return testCases.map((testCase) => _convertTestData(testCase, document))
}

/**
 * Convert a single TestData to use VSCode Range
 *
 * @param testCase TestData from the parser
 * @param document VSCode document for position conversion
 * @returns VscodeTestData
 */
function _convertTestData(testCase: TestData, document: vscode.TextDocument): VscodeTestData {
    // Convert SourceRange to VSCode Range
    const vsCodeRange = convertSourceRangeToVSCodeRange(testCase.range, document)

    // Convert children recursively
    const vsCodeChildren = testCase.children.map((child) => _convertTestData(child, document))

    return {
        type: testCase.type,
        name: testCase.name,
        uri: document.uri,
        range: vsCodeRange,
        children: vsCodeChildren,
    }
}

/**
 * Convert a SourceRange to a VSCode Range
 *
 * @param sourceRange SourceRange with offsets
 * @param document VSCode document for position conversion
 * @returns VSCode Range
 */
function convertSourceRangeToVSCodeRange(sourceRange: SourceRange, document: vscode.TextDocument): vscode.Range {
    const start = document.positionAt(sourceRange.start.offset)
    const end = document.positionAt(sourceRange.end.offset)
    return new vscode.Range(start, end)
}

/**
 * Parse test file content and adapt to VSCode compatible format
 *
 * @param fileContent Test file content
 * @param document VSCode document
 * @param filePath File URI for error reporting
 * @returns Array of VSCode compatible TestData
 */
export async function parseAndConvertTestData(fileContent: string, filePath: string): Promise<VscodeTestData[]> {
    try {
        const document = await vscode.workspace.openTextDocument(convertPathToUri(filePath))
        const testCases = parseTestCases(fileContent, filePath)
        return convertTestData(testCases, document)
    } catch (error) {
        throw new Error(`Failed to parse or adapt test cases: ${(error as Error).message}`)
    }
}

export function convertPathToUri(filePath: string) {
    return vscode.Uri.file(filePath)
}
