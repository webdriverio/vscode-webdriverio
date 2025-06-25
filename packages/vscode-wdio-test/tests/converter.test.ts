import { join } from 'node:path'

import { describe, it, expect, vi } from 'vitest'
import * as vscode from 'vscode'

import { convertPathToUri, isCucumberFeatureFile } from '../src/converter.js'

// Mock dependencies
vi.mock('vscode', () => import('../../../tests/__mocks__/vscode.cjs'))
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

describe('Converter', () => {
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
