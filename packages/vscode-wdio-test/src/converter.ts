import path from 'node:path'

import * as vscode from 'vscode'
import type { SourceRange } from '@vscode-wdio/types/test'

export function convertSourceRangeToVSCodeRange(sourceRange: SourceRange): vscode.Range {
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
