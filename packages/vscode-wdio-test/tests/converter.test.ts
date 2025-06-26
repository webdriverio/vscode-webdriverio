import { join } from 'node:path'

import { describe, it, expect, vi } from 'vitest'
import * as vscode from 'vscode'

import { convertPathToUri, convertSourceRangeToVSCodeRange, isCucumberFeatureFile } from '../src/converter.js'

// Mock dependencies
vi.mock('vscode', () => import('../../../tests/__mocks__/vscode.cjs'))
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

describe('convertSourceRangeToVSCodeRange', () => {
    it('should convert range to VSCode.Range', () => {
        const sourceRange = {
            start: {
                line: 1,
                column: 1,
            },
            end: {
                line: 10,
                column: 10,
            },
        }
        const result = convertSourceRangeToVSCodeRange(sourceRange)

        expect(result.start.line).toEqual(1)
        expect(result.end.line).toEqual(10)
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
