import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { expect, describe, it, vi } from 'vitest'
import * as vscode from 'vscode'

import { convertUriToPath, normalizePath } from '../src/normalize.js'

vi.mock('vscode', () => import('../../../tests/__mocks__/vscode.cjs'))
vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

describe('normalizePath', () => {
    const filePath = `${process.cwd()}\\path\\to\\file`
    const normalizedPath = path.normalize(path.join(process.cwd(), 'path', 'to', 'file'))

    it('should normalize path correctly', () => {
        // Execute
        const result = normalizePath(filePath)

        // Verify
        expect(result).to.equal(path.normalize(filePath))
    })

    it('should normalize URL correctly', () => {
        // Setup
        const fileUrl = pathToFileURL(path.join(process.cwd(), 'path', 'to', 'file')).toString()

        // Execute
        const result = normalizePath(fileUrl)

        // Verify
        expect(result).to.equal(normalizedPath)
    })
})

describe('convertUriToPath', () => {
    it('should convert file path to VSCode URI - Windows', () => {
        const filePath = path.join(process.cwd(), 'path', 'to', 'spec.js')
        const uri = vscode.Uri.file(filePath)
        const result = convertUriToPath(uri)

        expect(result).toBe(filePath)
        if (process.platform === 'win32') {
            expect(filePath).toMatch(/^([A-Z]):/)
            expect(result).toMatch(/^([A-Z]):/)
        }
    })
})
