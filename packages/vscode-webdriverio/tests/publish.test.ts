import shell from 'shelljs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { publish } from '../scripts/publish.js'

vi.mock('shelljs', () => ({
    default: {
        exec: vi.fn(),
    },
}))

describe('publish script', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        vi.mocked(shell.exec).mockReturnValue({ code: 0 } as any)
    })

    it('should skip publishing when VSCODE_WDIO_DRY_RUN is yes', () => {
        publish([], { VSCODE_WDIO_DRY_RUN: 'yes', OVSX_PAT: 'token' })
        expect(shell.exec).not.toHaveBeenCalled()
    })

    it('should publish only to VS Code Marketplace when OVSX_PAT is not set', () => {
        publish([], {})
        expect(shell.exec).toHaveBeenCalledTimes(1)
        expect(shell.exec).toHaveBeenCalledWith('vsce publish')
    })

    it('should publish to both VS Code Marketplace and OpenVSX when OVSX_PAT is set', () => {
        publish(['--pre-release'], { OVSX_PAT: 'ovsx-token' })
        expect(shell.exec).toHaveBeenCalledTimes(2)
        expect(shell.exec).toHaveBeenNthCalledWith(1, 'vsce publish --pre-release')
        expect(shell.exec).toHaveBeenNthCalledWith(2, 'npx ovsx publish --pre-release')
    })

    it('should exit with non-zero code if vsce publish fails', () => {
        const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
            throw new Error('exit')
        }) as any)
        vi.mocked(shell.exec).mockReturnValueOnce({ code: 1 } as any)

        expect(() => publish([], { OVSX_PAT: 'ovsx-token' })).toThrow('exit')
        expect(exitSpy).toHaveBeenCalledWith(1)
        expect(shell.exec).toHaveBeenCalledTimes(1)
        exitSpy.mockRestore()
    })
})
