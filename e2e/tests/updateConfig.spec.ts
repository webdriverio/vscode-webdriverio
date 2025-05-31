// /Users/abetaiki/Documents/50_workspace/30_js/wdio-vscode/samples/smoke/mocha/wdio.conf.ts.tmplate
import path from 'node:path'
import url from 'node:url'

import { browser, expect } from '@wdio/globals'
import shell from 'shelljs'

import {
    STATUS,
    clearAllTestResults,
    clickTreeItemButton,
    getTestingSection,
    openTestingView,
    waitForResolved,
    waitForTestStatus,
} from '../helpers.ts'

import type { SideBarView, Workbench } from 'wdio-vscode-service'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..', '..')
const workspacePath = path.resolve(rootDir, 'samples/smoke/update-config/')
const beforeConfig = path.resolve(workspacePath, 'wdio.conf.ts')
const afterConfig = path.resolve(workspacePath, 'wdio.conf.ts.template')

describe('VS Code Extension Testing (Update config)', function () {
    let workbench: Workbench
    let sideBarView: SideBarView<any>

    beforeEach(async () => {
        workbench = await browser.getWorkbench()
        await openTestingView(workbench)
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
    this.afterAll(() => {
        shell.exec(`git checkout ${beforeConfig}`)
    })

    it('should be resolved the defined tests after configuration changed', async () => {
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
                ],
            },
        ])

        // Emulate the changing configuration
        shell.cp('-f', afterConfig, beforeConfig)
        await new Promise((resolve) => setTimeout(resolve, 3000))
        await browser.waitUntil(
            async () => {
                if (!(await items[0].isExpanded())) {
                    await items[0].expand()
                }

                const children = await items[0].getChildren()
                const target = children[0]
                if (!target) {
                    return false
                }
                const regex = new RegExp('after.test.ts')
                return regex.test(await target.getLabel())
            },
            {
                timeoutMsg: 'The label "after.test.ts" is not found.',
            }
        )

        await expect(items).toMatchTreeStructure([
            {
                text: 'wdio.conf.ts',
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

    it('should run tests successfully after changing the configuration', async () => {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        await clickTreeItemButton(browser, items[0], 'Run Test')

        await waitForTestStatus(browser, items[0], STATUS.PASSED)

        await expect(items).toMatchTreeStructure([
            {
                text: 'wdio.conf.ts',
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
