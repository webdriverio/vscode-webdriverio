import path from 'node:path'

import * as vscode from 'vscode'
import type { ReadSpecsResult } from '@vscode-wdio/types/api'
import type { TestData, SourceRange, VscodeTestData } from '@vscode-wdio/types/test'
/**
 * Convert the parser's TestData to VSCode compatible TestData
 *
 * @param testCases Array of TestData from the parser
 * @param document VSCode document for position conversion
 * @returns Array of VscodeTestData
 */
export async function convertTestData(testData: ReadSpecsResult): Promise<VscodeTestData[]> {
    try {
        const uri = convertPathToUri(testData.spec)

        return testData.tests.map((testCase) => _convertTestData(testCase, uri))
    } catch (error) {
        throw new Error(`Failed to parse or adapt test cases: ${(error as Error).message}`)
    }
}

/**
 * Convert a single TestData to use VSCode Range
 *
 * @param testCase TestData from the parser
 * @param uri VSCode Uri for Spec file
 * @returns VscodeTestData
 */
function _convertTestData(testCase: TestData, uri: vscode.Uri): VscodeTestData {
    // Convert SourceRange to VSCode Range
    const vsCodeRange = convertSourceRangeToVSCodeRange(testCase.range)

    // Convert children recursively
    const vsCodeChildren = testCase.children.map((child) => _convertTestData(child, uri))

    return {
        type: testCase.type,
        name: testCase.name,
        uri,
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
function convertSourceRangeToVSCodeRange(sourceRange: SourceRange): vscode.Range {
    const start = new vscode.Position(sourceRange.start.line, sourceRange.start.column)
    const end = new vscode.Position(sourceRange.end.line, sourceRange.end.column)
    return new vscode.Range(start, end)
}

export function convertPathToUri(filePath: string) {
    return vscode.Uri.file(filePath)
}

/**
 * Check if a file is a Cucumber feature file
 * @param filePath File path to check
 * @returns True if it's a feature file
 */
export function isCucumberFeatureFile(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.feature'
}
