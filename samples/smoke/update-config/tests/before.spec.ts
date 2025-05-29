import { expect } from '@wdio/globals'

import { add } from '../index.js'

describe('Before Tests', () => {
    it('TEST BEFORE 1', async () => {
        expect(add(1, 2)).toBe(3)
    })
})
