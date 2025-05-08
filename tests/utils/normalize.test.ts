import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { expect, describe, it } from 'vitest'

import { normalizePath } from '../../src/utils/normalize.js'

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
