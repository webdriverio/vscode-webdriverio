import path from 'node:path'
import url from 'node:url'

import { browser, expect } from '@wdio/globals'
import shell from 'shelljs'

import {
    STATUS,
    clearAllTestResults,
    clickTreeItemButton,
    collapseAllTests,
    getTestingSection,
    openTestingView,
    resetFileChange,
    waitForResolved,
    waitForTestStatus,
} from '../helpers/index.js'

import type { SideBarView, Workbench } from 'wdio-vscode-service'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..', '..')
const workspacePath = path.resolve(rootDir, 'samples/smoke/update-config/')
const beforeConfig = path.resolve(workspacePath, 'wdio.conf.ts')
const afterConfig = path.resolve(workspacePath, 'wdio-error.conf.ts.template')

describe('VS Code Extension Testing (Update config)', function () {
    let workbench: Workbench
    let sideBarView: SideBarView<any>

    beforeEach(async function () {
        workbench = await browser.getWorkbench()
        await openTestingView(workbench)
        sideBarView = workbench.getSideBar()

        const testingSection = await getTestingSection(sideBarView.getContent())
        await collapseAllTests(testingSection)

        await browser.waitUntil(async () => (await testingSection.getVisibleItems()).length === 1)
    })

    afterEach(async function () {
        await clearAllTestResults(workbench)
    })

    after(function () {
        resetFileChange(beforeConfig)
    })

    it('should be resolved the configuration file with no spec files', async function () {
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
        shell.cp('-f', afterConfig, beforeConfig)
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await expect(items).toMatchTreeStructure([
            {
                text: 'wdio.conf.ts',
                status: STATUS.NOT_YET_RUN,
                children: [],
            },
        ])
    })

    it('should run tests successfully after changing the valid configuration', async function () {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        resetFileChange(beforeConfig)
        await new Promise((resolve) => setTimeout(resolve, 1000))

        await clickTreeItemButton(browser, items[0], 'Run Test')

        await waitForTestStatus(browser, items[0], STATUS.PASSED)

        await expect(items).toMatchTreeStructure([
            {
                text: 'wdio.conf.ts',
                status: STATUS.PASSED,
                children: [
                    {
                        text: 'before.spec.ts',
                        status: STATUS.PASSED,
                        children: [
                            {
                                text: 'Before Tests',
                                status: STATUS.PASSED,
                                children: [{ text: 'TEST BEFORE 1', status: STATUS.PASSED }],
                            },
                        ],
                    },
                    {
                        text: 'sample.spec.ts',
                        status: STATUS.PASSED,
                        children: [
                            {
                                text: 'Sample 1',
                                status: STATUS.PASSED,
                                children: [{ text: 'TEST SAMPLE 1', status: STATUS.PASSED }],
                            },
                        ],
                    },
                ],
            },
        ])
    })
})
