import { browser, expect } from '@wdio/globals'
import { createExpected } from 'helpers/constants.ts'

import {
    STATUS,
    clearAllTestResults,
    clickTitleActionButton,
    clickTreeItemButton,
    getTestingSection,
    openTestingView,
    waitForResolved,
    waitForTestStatus,
} from '../helpers/index.ts'

import type { SideBarView, ViewControl, Workbench } from 'wdio-vscode-service'

const targetFramework = (process.env.VSCODE_WDIO_E2E_FRAMEWORK || 'mocha') as 'mocha' | 'jasmine'

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
        const items = (await testingSection.getVisibleItems()).reverse()
        for (const item of items) {
            if ((await item.isExpandable()) && (await item.isExpanded())) {
                await item.collapse()
            }
        }
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
})
