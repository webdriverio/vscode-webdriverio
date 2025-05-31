import { browser, expect } from '@wdio/globals'

import {
    STATUS,
    clearAllTestResults,
    clickTreeItemButton,
    getTestingSection,
    openTestingView,
    waitForResolved,
    waitForTestStatus,
} from '../helpers.ts'

import type { SideBarView, ViewControl, Workbench } from 'wdio-vscode-service'

const targetFramework = process.env.VSCODE_WDIO_E2E_FRAMEWORK || 'mocha'

describe(`VS Code Extension Testing with ${targetFramework}`, function () {
    this.retries(3)
    let workbench: Workbench
    let testingViewControl: ViewControl
    let sideBarView: SideBarView<any>

    beforeEach(async () => {
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

    afterEach(async () => {
        await clearAllTestResults(workbench)
    })

    it('should be displayed the testing screen at the sideBar', async () => {
        expect(await testingViewControl.getTitle()).toBe('Testing')
        expect(await sideBarView.getTitlePart().getTitle()).toBe('TESTING')
    })

    it('should resolve defined tests correctly', async () => {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        await expect(items).toMatchTreeStructure([
            {
                text: 'wdio.conf.ts',
                status: STATUS.NOT_YET_RUN,
                children: [
                    {
                        text: `${targetFramework}.spec.ts`,
                        status: STATUS.NOT_YET_RUN,
                        children: [
                            {
                                text: 'Website Tests',
                                status: STATUS.NOT_YET_RUN,
                                children: [
                                    { text: 'should be a pending test', status: STATUS.NOT_YET_RUN },
                                    { text: 'should have the right title - WebdriverIO', status: STATUS.NOT_YET_RUN },
                                    {
                                        text: 'should have the right title - WebdriverJS Testpage',
                                        status: STATUS.NOT_YET_RUN,
                                    },
                                    { text: 'should fail', status: STATUS.NOT_YET_RUN },
                                ],
                            },
                        ],
                    },
                ],
            },
        ])
    })

    it('should run at top Level', async () => {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        await clickTreeItemButton(browser, items[0], 'Run Test')

        await waitForTestStatus(browser, items[0], STATUS.FAILED)

        await expect(items).toMatchTreeStructure([
            {
                text: 'wdio.conf.ts',
                status: STATUS.FAILED,
                children: [
                    {
                        text: `${targetFramework}.spec.ts`,
                        status: STATUS.FAILED,
                        children: [
                            {
                                text: 'Website Tests',
                                status: STATUS.FAILED,
                                children: [
                                    { text: 'should be a pending test', status: STATUS.SKIPPED },
                                    { text: 'should have the right title - WebdriverIO', status: STATUS.PASSED },
                                    {
                                        text: 'should have the right title - WebdriverJS Testpage',
                                        status: STATUS.PASSED,
                                    },
                                    { text: 'should fail', status: STATUS.FAILED },
                                ],
                            },
                        ],
                    },
                ],
            },
        ])
    })

    it('should run at not top Level', async () => {
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

        await expect(items).toMatchTreeStructure([
            {
                text: 'wdio.conf.ts',
                status: STATUS.PASSED,
                children: [
                    {
                        text: `${targetFramework}.spec.ts`,
                        status: STATUS.PASSED,
                        children: [
                            {
                                text: 'Website Tests',
                                status: STATUS.PASSED,
                                children: [
                                    { text: 'should be a pending test', status: STATUS.NOT_YET_RUN },
                                    { text: 'should have the right title - WebdriverIO', status: STATUS.PASSED },
                                    {
                                        text: 'should have the right title - WebdriverJS Testpage',
                                        status: STATUS.NOT_YET_RUN,
                                    },
                                    { text: 'should fail', status: STATUS.NOT_YET_RUN },
                                ],
                            },
                        ],
                    },
                ],
            },
        ])
    })
})
