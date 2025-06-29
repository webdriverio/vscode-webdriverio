import { browser, expect } from '@wdio/globals'
import { createExpected } from 'helpers/constants.js'

import {
    STATUS,
    clearAllTestResults,
    clickTitleActionButton,
    clickTreeItemButton,
    collapseAllTests,
    getTestingSection,
    openTestingView,
    waitForResolved,
    waitForTestStatus,
} from '../helpers/index.js'

import type { SideBarView, ViewControl, Workbench } from 'wdio-vscode-service'

const targetFramework = (process.env.VSCODE_WDIO_E2E_SCENARIO || 'mocha') as 'mocha' | 'jasmine'

const expected = createExpected(targetFramework)

describe(`VS Code Extension Testing with ${targetFramework}`, function () {
    this.retries(3)
    let workbench: Workbench
    let testingViewControl: ViewControl
    let sideBarView: SideBarView<any>

    beforeEach(async function () {
        workbench = await browser.getWorkbench()
        testingViewControl = await openTestingView(workbench)
        sideBarView = workbench.getSideBar()

        const testingSection = await getTestingSection(sideBarView.getContent())
        await collapseAllTests(testingSection)

        await browser.waitUntil(async () => (await testingSection.getVisibleItems()).length === 1)
    })

    afterEach(async function () {
        await clearAllTestResults(workbench)
    })

    it('should be displayed the testing screen at the sideBar', async function () {
        expect(await testingViewControl.getTitle()).toBe('Testing')
        expect(await sideBarView.getTitlePart().getTitle()).toBe('TESTING')
    })

    it('should resolve defined tests correctly', async function () {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        await expect(items).toMatchTreeStructure(expected.notRun)
    })

    it('should run at top Level', async function () {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        await clickTitleActionButton(sideBarView.getTitlePart(), 'Run Tests')

        await waitForTestStatus(browser, items[0], STATUS.FAILED)

        await expect(items).toMatchTreeStructure(expected.runAll)
    })

    it('should run at not top Level', async function () {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        const target = await items[0]
            .getChildren()
            .then((items) => items[0].getChildren())
            .then((items) => items[0].getChildren())
            .then((items) => items[1])

        await clickTreeItemButton(browser, target, 'Run Test')

        await waitForTestStatus(browser, items[0], STATUS.PASSED)

        await expect(items).toMatchTreeStructure(expected.runPartially)
    })

    // eslint-disable-next-line mocha/no-setup-in-describe
    if (process.env.VSCODE_WDIO_SMOKE_RETRO_WIN === 'yes') {

        it('should use temporally configuration file', async function () {
            await expect(workbench).hasExpectedLog('Use temporary configuration files @wdio/utils@9.15.0 < 9.16.0')
        })

        // eslint-disable-next-line mocha/no-setup-in-describe
    } else if (process.env.VSCODE_WDIO_SMOKE_RETRO_WIN === 'no') {

        it('should not use temporally configuration file', async function () {
            await expect(workbench).not.hasExpectedLog('Use temporary configuration files @wdio/utils@9.15.0 < 9.16.0')
        })
    }
})
