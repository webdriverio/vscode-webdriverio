import { join } from 'node:path'

import { expect, describe, it, vi } from 'vitest'
import * as vscode from 'vscode'

import { convertUriToPath } from '../src/index.js'

vi.mock('vscode', () => import('../../../tests/__mocks__/vscode.cjs'))
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

describe('convertUriToPath', () => {
    it('should convert file path to VSCode URI - Windows', () => {
        const filePath = join(process.cwd(), 'path', 'to', 'spec.js')
        const uri = vscode.Uri.file(filePath)
        const result = convertUriToPath(uri)

        expect(result).toBe(filePath)
        if (process.platform === 'win32') {
            expect(filePath).toMatch(/^([A-Z]):/)
            expect(result).toMatch(/^([A-Z]):/)
        }
    })
})
