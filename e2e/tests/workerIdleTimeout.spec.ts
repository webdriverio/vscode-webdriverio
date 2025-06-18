import { browser, expect } from '@wdio/globals'

import { createCucumberExpected } from '../helpers/cucumber.ts'
import {
    STATUS,
    clearAllTestResults,
    clickTitleActionButton,
    collapseAllTests,
    getTestingSection,
    openTestingView,
    waitForResolved,
    waitForTestStatus,
} from '../helpers/index.ts'

import type { SideBarView, ViewControl, Workbench } from 'wdio-vscode-service'

const targetFramework = process.env.VSCODE_WDIO_E2E_SCENARIO || 'mocha'

const expected = createCucumberExpected()

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

    it('should shutdown the work process after idle timeout was reached', async function () {
        await new Promise((resolve) => setTimeout(resolve, 2000))

        await expect(workbench).hasExpectedLog(/Worker#0 process shutdown gracefully/)

        const bottomBar = workbench.getBottomBar()
        const outputView = await bottomBar.openOutputView()
        await outputView.selectChannel('WebdriverIO')
        await outputView.clearText()
    })

    it('should start work process and run test successfully', async function () {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        await clickTitleActionButton(sideBarView.getTitlePart(), 'Run Tests')

        await waitForTestStatus(browser, items[0], STATUS.PASSED)

        // assert that start work process
        await expect(workbench).hasExpectedLog(/\[#1\] Worker process started successfully/)

        // assert that run test successfully
        await expect(items).toMatchTreeStructure(expected.runAll)
    })
})
