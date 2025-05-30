import { DefaultTreeSection } from 'wdio-vscode-service'
import type { StatusStrings } from 'assertions/index.ts'
import type { TreeItem, Workbench, ViewControl, ViewContent, ViewItemAction } from 'wdio-vscode-service'

export const STATUS = {
    NOT_YET_RUN: 'Not yet run',
    PASSED: 'Passed',
    FAILED: 'Failed',
    SKIPPED: 'Skipped',
} as const

export async function openTestingView(workbench: Workbench) {
    const activityBar = workbench.getActivityBar()
    let testingViewControl: ViewControl | undefined
    await browser.waitUntil(
        async () => {
            testingViewControl = await activityBar.getViewControl('Testing')
            return typeof testingViewControl !== 'undefined'
        },
        {
            timeoutMsg: 'Testing view was not opened',
        }
    )
    await testingViewControl!.openView()
    return testingViewControl!
}

export async function getTestingSection(content: ViewContent) {
    return new DefaultTreeSection(content.locatorMap, content.section$, content)
}

export async function waitForResolved(browser: WebdriverIO.Browser, item: TreeItem) {
    await browser.waitUntil(
        async () => {
            const regex = new RegExp('Resolving WebdriverIO Tests')
            return !regex.test(await item.getLabel())
        },
        {
            timeoutMsg: 'Resolving tests ware not finished',
        }
    )
}

export async function clickTreeItemButton(browser: WebdriverIO.Browser, target: TreeItem, buttonLabel: string) {
    let btn: ViewItemAction | undefined
    await browser.waitUntil(
        async () => {
            btn = await target.getActionButton(buttonLabel)
            if (btn && (await (btn.elem as WebdriverIO.Element).isClickable())) {
                return true
            }
            return false
        },
        {
            timeoutMsg: 'The button is not clickable.',
        }
    )

    btn = await target.getActionButton(buttonLabel)
    await (btn!.elem as WebdriverIO.Element).click()
}

export async function waitForTestStatus(browser: WebdriverIO.Browser, item: TreeItem, status: StatusStrings) {
    await browser.waitUntil(
        async () => {
            const label = await item.getLabel()
            // wdio.conf.ts (Passed), in 3.2s
            const matcherResult = label.match(/\(([^)]+)\), in .*s$/)
            return matcherResult && matcherResult[1] === status
        },
        {
            timeout: 180000,
            timeoutMsg: `expected status(${status}) to be different(current: ${await item.getLabel()})`,
        }
    )
}

export async function clearAllTestResults(browser: WebdriverIO.Browser, workbench: Workbench) {
    const bottomBarPanel = workbench.getBottomBar()
    const tabTitle = 'Test Results'
    const actionTitle = 'Clear All Results'
    try {
        await bottomBarPanel.toggle(true)
        const tabContainer = await bottomBarPanel.tabContainer$
        const tab = (await tabContainer.$(`.//a[starts-with(@aria-label, '${tabTitle}')]`)) as WebdriverIO.Element

        if (await tab.isExisting()) {
            await tab.click()
            await browser.waitUntil(
                async () => {
                    return await ((await bottomBarPanel.actions$) as WebdriverIO.Element)
                        .$(`.//a[@aria-label='${actionTitle}']`)
                        .isClickable()
                },
                {
                    timeoutMsg: `Failed to wait clickable for button: ${actionTitle}`,
                }
            )
            await ((await bottomBarPanel.actions$) as WebdriverIO.Element)
                .$(`.//a[@aria-label='${actionTitle}']`)
                .click()
        }
    } catch (_error) {
        console.log(_error)
    }
}
