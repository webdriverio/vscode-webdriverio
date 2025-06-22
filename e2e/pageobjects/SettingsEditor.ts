import { PageDecorator, SettingsEditor, BasePage, sleep } from 'wdio-vscode-service'

import { ListSetting as ListSettingLocators } from '../locators/index.js'
import * as locatorMap from '../locators/index.js'
import type { Workbench, IPageDecorator } from 'wdio-vscode-service'

class ExtendSettingsEditor extends SettingsEditor {
    extendedLocator = ListSettingLocators
    constructor(workbench: Workbench) {
        super(workbench.locatorMap)
    }

    async findListSetting(title: string, ...categories: string[]): Promise<ListSetting> {
        const category = categories.join(' › ')
        const searchBox = await this.elem.$(this.locatorMap.Editor.inputArea)
        await searchBox.setValue(`${category}: ${title}`)
        const count = await this.itemCount$
        let textCount = await count.getText()
        await browser.waitUntil(async () => {
            await sleep(1500)
            const text = await count.getText()
            if (text !== textCount) {
                textCount = text
                return false
            }
            return true
        })
        const items = await this.itemRow$$
        for (const item of items) {
            try {
                return await (await this.createListSetting(item, title, category)).wait()
            } catch {
                // ignore
            }
        }
        throw new Error('The setting is not found.')
    }

    private async createListSetting(element: WebdriverIO.Element, title: string, category: string) {
        if (!(await element.$(this.locators.settingConstructor(title, category)).isExisting())) {
            throw new Error('Setting not found')
        }
        // try a list setting
        if (await element.$(this.extendedLocator.listSetting).isExisting()) {
            return new ListSetting(locatorMap, title, category, this)
        }
        throw new Error('Setting type not supported')
    }
}

export interface ListSetting extends IPageDecorator<typeof ListSettingLocators> {}

@PageDecorator(ListSettingLocators)
export class ListSetting extends BasePage<typeof ListSettingLocators, typeof locatorMap> {
    constructor(
        locators: typeof locatorMap,
        title: string,
        category: string,
        public settings: SettingsEditor
    ) {
        super(locators, settings.locators.settingConstructor(title, category))
    }

    /**
     * @private
     */
    public locatorKey = 'ListSetting' as const

    async editValue(index: number, value: string) {
        const rows = this.listRow$$
        if (rows.length < index + 1) {
            throw new Error('invalid index')
        }
        await (rows[index] as WebdriverIO.Element).doubleClick()

        const editRow = await this.elem.$(this.locators.ListRowEdit)

        const input = await editRow.$(this.locators.ListRowTextSetting)
        const okBtn = editRow.$(this.locators.ListRowOkButton)

        await input.setValue(value)
        await okBtn.click()
    }
}

export { ExtendSettingsEditor as SettingsEditor }
