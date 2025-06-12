import { expect } from '@wdio/globals'

import { add } from '../index.js'

describe('Sample 1', () => {
    it('TEST SAMPLE 1', async () => {
        expect(add(1, 2)).toBe(3)
    })
})
