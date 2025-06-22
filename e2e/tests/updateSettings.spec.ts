import { browser, expect } from '@wdio/globals'
import { sleep } from 'wdio-vscode-service'

import {
    STATUS,
    clearAllTestResults,
    clickTreeItemButton,
    collapseAllTests,
    getTestingSection,
    openTestingView,
    waitForResolved,
    waitForTestStatus,
} from '../helpers/index.js'
import { SettingsEditor as ExtendSettingsEditor } from '../pageobjects/SettingsEditor.js'

import type { SideBarView, ViewControl, Workbench } from 'wdio-vscode-service'

describe('VS Code Extension Testing (Update config)', function () {
    let workbench: Workbench
    let sideBarView: SideBarView<any>
    let testingVew: ViewControl

    beforeEach(async function () {
        workbench = await browser.getWorkbench()
        testingVew = await openTestingView(workbench)
        sideBarView = workbench.getSideBar()

        const testingSection = await getTestingSection(sideBarView.getContent())
        await collapseAllTests(testingSection)

        await browser.waitUntil(async () => (await testingSection.getVisibleItems()).length === 1)
    })

    afterEach(async function () {
        await clearAllTestResults(workbench)
    })

    it('should be resolved the defined tests after settings changed', async function () {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        await expect(items).toMatchTreeStructure([
            {
                text: 'wdio.conf.ts',
                status: STATUS.NOT_YET_RUN,
                children: [
                    {
                        text: 'before.spec.ts',
                        status: STATUS.NOT_YET_RUN,
                        children: [
                            {
                                text: 'Before Tests',
                                status: STATUS.NOT_YET_RUN,
                                children: [{ text: 'TEST BEFORE 1', status: STATUS.NOT_YET_RUN }],
                            },
                        ],
                    },
                    {
                        text: 'sample.spec.ts',
                        status: STATUS.NOT_YET_RUN,
                        children: [
                            {
                                text: 'Sample 1',
                                status: STATUS.NOT_YET_RUN,
                                children: [{ text: 'TEST SAMPLE 1', status: STATUS.NOT_YET_RUN }],
                            },
                        ],
                    },
                ],
            },
        ])

        // Emulate the changing configuration
        await workbench.openSettings()

        await testingVew.closeView()
        await sleep(1500)

        const settingEditor = new ExtendSettingsEditor(workbench)
        const listSetting = await settingEditor.findListSetting('Config File Pattern', 'Webdriverio')
        await listSetting.editValue(0, '**/webdriverio.conf.ts')

        await workbench.getEditorView().closeAllEditors()
        await testingVew.openView()

        await waitForResolved(browser, items[0])

        await expect(items).toMatchTreeStructure([
            {
                text: 'webdriverio.conf.ts',
                status: STATUS.NOT_YET_RUN,
                children: [
                    {
                        text: 'after.test.ts',
                        status: STATUS.NOT_YET_RUN,
                        children: [
                            {
                                text: 'After Tests',
                                status: STATUS.NOT_YET_RUN,
                                children: [{ text: 'TEST AFTER 1', status: STATUS.NOT_YET_RUN }],
                            },
                        ],
                    },
                ],
            },
        ])
    })

    it('should run tests successfully after changing the settings', async function () {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        await clickTreeItemButton(browser, items[0], 'Run Test')

        await waitForTestStatus(browser, items[0], STATUS.PASSED)

        await expect(items).toMatchTreeStructure([
            {
                text: 'webdriverio.conf.ts',
                status: STATUS.PASSED,
                children: [
                    {
                        text: 'after.test.ts',
                        status: STATUS.PASSED,
                        children: [
                            {
                                text: 'After Tests',
                                status: STATUS.PASSED,
                                children: [{ text: 'TEST AFTER 1', status: STATUS.PASSED }],
                            },
                        ],
                    },
                ],
            },
        ])
    })
})
