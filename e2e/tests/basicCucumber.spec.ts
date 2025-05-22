import { browser, expect } from '@wdio/globals'

import {
    STATUS,
    clearAllTestResults,
    getTestingSection,
    openTestingView,
    waitForResolved,
    waitForTestStatus,
} from '../helpers.ts'

import type { SideBarView, ViewControl, Workbench } from 'wdio-vscode-service'

const targetFramework = process.env.VSCODE_WDIO_E2E_FRAMEWORK || 'mocha'

describe(`VS Code Extension Testing with ${targetFramework}`, () => {
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
                        text: 'my-feature.feature',
                        status: STATUS.NOT_YET_RUN,
                        children: [
                            {
                                text: 'Example feature',
                                status: STATUS.NOT_YET_RUN,
                                children: [
                                    {
                                        text: 'Get title of website',
                                        status: STATUS.NOT_YET_RUN,
                                        children: [
                                            {
                                                text: 'Given I go on the website "https://webdriver.io"',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                            {
                                                text: 'Then should the title of the page be "WebdriverIO · Next-gen browser and mobile automation test framework for Node.js | WebdriverIO"',
                                                status: STATUS.NOT_YET_RUN,
                                            },
                                        ],
                                    },
                                    {
                                        text: 'Business rule 1',
                                        status: STATUS.NOT_YET_RUN,
                                        children: [
                                            {
                                                text: 'Get title of website',
                                                status: STATUS.NOT_YET_RUN,
                                                children: [
                                                    {
                                                        text: 'Given I go on the website "https://github.com/"',
                                                        status: STATUS.NOT_YET_RUN,
                                                    },
                                                    {
                                                        text: 'Then should the title of the page be "GitHub · Build and ship software on a single, collaborative platform · GitHub"',
                                                        status: STATUS.NOT_YET_RUN,
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                    {
                                        text: 'Business rule 2',
                                        status: STATUS.NOT_YET_RUN,
                                        children: [
                                            {
                                                text: 'Data Tables',
                                                status: STATUS.NOT_YET_RUN,
                                                children: [
                                                    {
                                                        text: 'Given I go on the website "http://todomvc.com/examples/react/dist/"',
                                                        status: STATUS.NOT_YET_RUN,
                                                    },
                                                    {
                                                        text: 'When I add the following groceries',
                                                        status: STATUS.NOT_YET_RUN,
                                                    },
                                                    {
                                                        text: 'Then I should have a list of 4 items',
                                                        status: STATUS.NOT_YET_RUN,
                                                    },
                                                ],
                                            },
                                        ],
                                    },
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

        const actionRunTest = await items[0].getActionButton('Run Test')
        await (actionRunTest!.elem as WebdriverIO.Element).click()

        await waitForTestStatus(browser, items[0], STATUS.PASSED)

        await expect(items).toMatchTreeStructure([
            {
                text: 'wdio.conf.ts',
                status: STATUS.PASSED,
                children: [
                    {
                        text: 'my-feature.feature',
                        status: STATUS.PASSED,
                        children: [
                            {
                                text: 'Example feature',
                                status: STATUS.PASSED,
                                children: [
                                    {
                                        text: 'Get title of website',
                                        status: STATUS.PASSED,
                                        children: [
                                            {
                                                text: 'Given I go on the website "https://webdriver.io"',
                                                status: STATUS.PASSED,
                                            },
                                            {
                                                text: 'Then should the title of the page be "WebdriverIO · Next-gen browser and mobile automation test framework for Node.js | WebdriverIO"',
                                                status: STATUS.PASSED,
                                            },
                                        ],
                                    },
                                    {
                                        text: 'Business rule 1',
                                        status: STATUS.PASSED,
                                        children: [
                                            {
                                                text: 'Get title of website',
                                                status: STATUS.PASSED,
                                                children: [
                                                    {
                                                        text: 'Given I go on the website "https://github.com/"',
                                                        status: STATUS.PASSED,
                                                    },
                                                    {
                                                        text: 'Then should the title of the page be "GitHub · Build and ship software on a single, collaborative platform · GitHub"',
                                                        status: STATUS.PASSED,
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                    {
                                        text: 'Business rule 2',
                                        status: STATUS.PASSED,
                                        children: [
                                            {
                                                text: 'Data Tables',
                                                status: STATUS.PASSED,
                                                children: [
                                                    {
                                                        text: 'Given I go on the website "http://todomvc.com/examples/react/dist/"',
                                                        status: STATUS.PASSED,
                                                    },
                                                    {
                                                        text: 'When I add the following groceries',
                                                        status: STATUS.PASSED,
                                                    },
                                                    {
                                                        text: 'Then I should have a list of 4 items',
                                                        status: STATUS.PASSED,
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ])
    })

    it('should run Scenario level even if select step level test', async () => {
        const testingSection = await getTestingSection(sideBarView.getContent())
        const items = await testingSection.getVisibleItems()

        await waitForResolved(browser, items[0])

        const target = await items[0]
            .getChildren()
            .then((items) => items[0].getChildren())
            .then((items) => items[0].getChildren())
            .then((items) => items[0].getChildren())
            .then((items) => items[1])

        const actionRunTest = await target.getActionButton('Run Test')
        await (actionRunTest!.elem as WebdriverIO.Element).click()

        await waitForTestStatus(browser, items[0], STATUS.PASSED)

        await expect(items).toMatchTreeStructure([
            {
                text: 'wdio.conf.ts',
                status: STATUS.PASSED,
                children: [
                    {
                        text: 'my-feature.feature',
                        status: STATUS.PASSED,
                        children: [
                            {
                                text: 'Example feature',
                                status: STATUS.PASSED,
                                children: [
                                    {
                                        text: 'Get title of website',
                                        status: STATUS.PASSED,
                                        children: [
                                            {
                                                text: 'Given I go on the website "https://webdriver.io"',
                                                status: STATUS.PASSED,
                                            },
                                            {
                                                text: 'Then should the title of the page be "WebdriverIO · Next-gen browser and mobile automation test framework for Node.js | WebdriverIO"',
                                                status: STATUS.PASSED,
                                            },
                                        ],
                                    },
                                    {
                                        text: 'Business rule 1',
                                        status: STATUS.NOT_YET_RUN,
                                        children: [
                                            {
                                                text: 'Get title of website',
                                                status: STATUS.NOT_YET_RUN,
                                                children: [
                                                    {
                                                        text: 'Given I go on the website "https://github.com/"',
                                                        status: STATUS.NOT_YET_RUN,
                                                    },
                                                    {
                                                        text: 'Then should the title of the page be "GitHub · Build and ship software on a single, collaborative platform · GitHub"',
                                                        status: STATUS.NOT_YET_RUN,
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                    {
                                        text: 'Business rule 2',
                                        status: STATUS.NOT_YET_RUN,
                                        children: [
                                            {
                                                text: 'Data Tables',
                                                status: STATUS.NOT_YET_RUN,
                                                children: [
                                                    {
                                                        text: 'Given I go on the website "http://todomvc.com/examples/react/dist/"',
                                                        status: STATUS.NOT_YET_RUN,
                                                    },
                                                    {
                                                        text: 'When I add the following groceries',
                                                        status: STATUS.NOT_YET_RUN,
                                                    },
                                                    {
                                                        text: 'Then I should have a list of 4 items',
                                                        status: STATUS.NOT_YET_RUN,
                                                    },
                                                ],
                                            },
                                        ],
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
