import { describe, it, vi, expect } from 'vitest'

import { loggingFn } from '../../src/api/utils.js'
import { LOG_LEVEL } from '../../src/constants.js'
import { log } from '../../src/utils/logger.js'

vi.mock('vscode', () => {
    return {}
})

vi.mock('../../src/utils/logger.js', () => ({
    log: {
        trace: vi.fn(),
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}))

describe('loggingFn', () => {
    it('should call the appropriate log method based on log level', async () => {
        // Test each log level
        await loggingFn(LOG_LEVEL.TRACE, 'trace message')
        expect(log.trace).toHaveBeenCalledWith('trace message')

        await loggingFn(LOG_LEVEL.DEBUG, 'debug message')
        expect(log.debug).toHaveBeenCalledWith('debug message')

        await loggingFn(LOG_LEVEL.INFO, 'info message')
        expect(log.info).toHaveBeenCalledWith('info message')

        await loggingFn(LOG_LEVEL.WARN, 'warn message')
        expect(log.warn).toHaveBeenCalledWith('warn message')

        await loggingFn(LOG_LEVEL.ERROR, 'error message')
        expect(log.error).toHaveBeenCalledWith('error message')

        // Test default case
        // @ts-expect-error
        await loggingFn(999, 'unknown level message')
        expect(log.debug).toHaveBeenCalledWith('unknown level message')
    })
})
