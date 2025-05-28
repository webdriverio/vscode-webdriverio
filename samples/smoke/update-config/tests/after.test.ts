import { expect } from '@wdio/globals'

import { add } from '../index.js'

describe('After Tests', () => {
    it('TEST AFTER 1', async () => {
        expect(add(1, 2)).toBe(3)
    })
})
