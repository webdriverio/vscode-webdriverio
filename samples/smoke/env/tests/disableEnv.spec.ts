import { expect } from '@wdio/globals'

describe('Enable Environment variables', () => {
    it('should set the environment variables SMOKE_TEST_SCENARIO', async () => {
        expect(process.env.SMOKE_TEST_SCENARIO).toBe('DISABLED')
    })

    it('should not set the environment variables SMOKE_TEST_ENV_TEST_01', async () => {
        expect(process.env.SMOKE_TEST_ENV_TEST_01).toBe(undefined)
    })
})
