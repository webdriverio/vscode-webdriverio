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
    waitForResolved,
    waitForTestStatus,
} from '../helpers/index.ts'

import type { SideBarView, Workbench } from 'wdio-vscode-service'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..', '..')
const workspacePath = path.resolve(rootDir, 'samples/smoke/env')
const envPath = {
    before: path.resolve(workspacePath, '.env'),
    after: path.resolve(workspacePath, '.env.disabled'),
}

describe('VS Code Extension Testing (EnableEnv)', function () {
    let workbench: Workbench
    let sideBarView: SideBarView<any>

    before(function () {
        shell.cp('-f', envPath.after, envPath.before)
    })

    beforeEach(async function () {
        workbench = await browser.getWorkbench()
        await openTestingView(workbench)
        sideBarView = workbench.getSideBar()

        const testingSection = await getTestingSection(sideBarView.getContent())
        await collapseAllTests(testingSection)

        await browser.waitUntil(async () => (await testingSection.getVisibleItems()).length === 1)
    })

    afterEach(async function () {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        await clearAllTestResults(workbench)
    })

    after(function () {
        shell.exec(`git checkout ${envPath.before}`)
    })

    it('should be resolved the defined tests before run tests', async function () {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        await expect(items).toMatchTreeStructure([
            {
                text: 'wdio.conf.ts',
                status: STATUS.NOT_YET_RUN,
                children: [
                    {
                        text: 'disableEnv.spec.ts',
                        status: STATUS.NOT_YET_RUN,
                        children: [
                            {
                                text: 'Enable Environment variables',
                                status: STATUS.NOT_YET_RUN,
                                children: [
                                    {
                                        text: 'should set the environment variables SMOKE_TEST_SCENARIO',
                                        status: STATUS.NOT_YET_RUN,
                                    },
                                    {
                                        text: 'should not set the environment variables SMOKE_TEST_ENV_TEST_01',
                                        status: STATUS.NOT_YET_RUN,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ])
    })

    it('should run tests successfully with env files', async function () {
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
                        text: 'disableEnv.spec.ts',
                        status: STATUS.PASSED,
                        children: [
                            {
                                text: 'Enable Environment variables',
                                status: STATUS.PASSED,
                                children: [
                                    {
                                        text: 'should set the environment variables SMOKE_TEST_SCENARIO',
                                        status: STATUS.PASSED,
                                    },
                                    {
                                        text: 'should not set the environment variables SMOKE_TEST_ENV_TEST_01',
                                        status: STATUS.PASSED,
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ])
    })
})
