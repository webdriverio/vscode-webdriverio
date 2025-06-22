import { browser, expect } from '@wdio/globals'
import { createWorkspaceExpected } from 'helpers/constants.js'

import {
    STATUS,
    clearAllTestResults,
    collapseAllTests,
    clickTitleActionButton,
    clickTreeItemButton,
    getTestingSection,
    openTestingView,
    waitForResolved,
    waitForTestStatus,
} from '../helpers/index.js'
import type { SideBarView, ViewControl, Workbench } from 'wdio-vscode-service'

const expected = createWorkspaceExpected()

describe('VS Code Extension Testing with Workspace', function () {
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
        await browser.waitUntil(async () => (await testingSection.getVisibleItems()).length === 3)
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

        expect(items.length).toBe(expected.notRun.length)

        /**
         * Because of the small screen size of the CI environment,
         * the tree is expanded and asserted per workspace.
         */
        for (let index = 0; index < expected.notRun.length; index++) {
            await expect([items[index]]).toMatchTreeStructure([expected.notRun[index]])

            await collapseAllTests(testingSection)
        }
    })

    it('should run at top Level', async function () {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        await clickTitleActionButton(sideBarView.getTitlePart(), 'Run Tests')

        expect(items.length).toBe(expected.runAll.length)

        await waitForTestStatus(browser, items[0], STATUS.PASSED)
        await waitForTestStatus(browser, items[1], STATUS.FAILED)
        await waitForTestStatus(browser, items[2], STATUS.FAILED)

        /**
         * Because of the small screen size of the CI environment,
         * the tree is expanded and asserted per workspace.
         */
        for (let index = 0; index < expected.runAll.length; index++) {
            await expect([items[index]]).toMatchTreeStructure([expected.runAll[index]])

            await collapseAllTests(testingSection)
        }
    })

    it('should run at not top Level', async function () {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])
        await waitForResolved(browser, items[0])

        const target = await items[1]
            .getChildren()
            .then((items) => items[0].getChildren())
            .then((items) => items[0].getChildren())
            .then((items) => items[0].getChildren())
            .then((items) => items[1])

        await clickTreeItemButton(browser, target, 'Run Test')

        expect(items.length).toBe(expected.runPartially.length)
        await waitForTestStatus(browser, items[1], STATUS.PASSED)

        /**
         * Because of the small screen size of the CI environment,
         * the tree is expanded and asserted per workspace.
         */
        for (let index = 0; index < expected.runPartially.length; index++) {
            await expect([items[index]]).toMatchTreeStructure([expected.runPartially[index]])

            await collapseAllTests(testingSection)
        }
    })
})
