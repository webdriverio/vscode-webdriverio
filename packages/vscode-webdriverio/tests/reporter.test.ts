import VscodeJsonReporter from '@vscode-wdio/reporter'
import { describe, expect, it } from 'vitest'

describe('reporter', () => {
    it('should exported', async () => {
        const reporter = await import('../src/reporter.js')

        expect(reporter.default).toBe(VscodeJsonReporter)
    })
})
