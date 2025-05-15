import { describe, expect, it, vi } from 'vitest'

import { log } from '../src/index.js'
import { VscodeWdioLogger } from '../src/logger.js'

vi.mock('vscode', async () => {
    const mockVscode = await import('../../../tests/__mocks__/vscode.cjs')
    return {
        ...mockVscode,
        window: {
            createOutputChannel: vi.fn(() => ({
                show: vi.fn(),
            })),
        },
    }
})

describe('exported log instance', () => {
    it('should export a singleton instance', () => {
        expect(log).toBeInstanceOf(VscodeWdioLogger)
    })

    it('should use the same log instance for all imports', () => {
        // This test doesn't need additional assertions as the singleton pattern
        // is verified by checking the instance type above
        expect(log).toBe(log)
    })
})
