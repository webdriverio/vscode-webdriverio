import { browser, expect } from '@wdio/globals'

describe('Website Tests', () => {
    it('should be a pending test')

    it('should have the right title - WebdriverIO', async () => {
        await browser.url('https://webdriver.io')
        await expect(browser).toHaveTitle(
            'WebdriverIO · Next-gen browser and mobile automation test framework for Node.js | WebdriverIO'
        )
    })

    it('should have the right title - WebdriverJS Testpage', async () => {
        await browser.url('https://guinea-pig.webdriver.io/')
        await expect(browser).toHaveTitle('WebdriverJS Testpage')
    })

    it('should fail', async () => {
        await browser.url('https://guinea-pig.webdriver.io/')
        await expect(browser).toHaveTitle('Wrong title is set to force fail the test')
    })
})
