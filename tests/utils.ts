import { vi } from 'vitest'
import type * as vscode from 'vscode'

export function createTestItem(id: string, metadata?: any, parent: vscode.TestItem | null = null) {
    const _metadata = !metadata
        ? undefined
        : Object.assign(
            {
                isWorkspace: false,
                isConfigFile: false,
                isSpecFile: false,
                isTestcase: false,
            },
            metadata
        )

    const testItem = {
        id,
        label: id,
        uri: { fsPath: '/path/to/test.js' } as vscode.Uri,
        children: new MockTestItemCollection(),
        canResolveChildren: false,
        busy: false,
        parent,
        range: {
            start: { line: 10, character: 0 },
            end: { line: 20, character: 0 },
        },
    } as unknown as vscode.TestItem

    return { testItem, metadata: _metadata }
}

export class MockTestItemCollection implements vscode.TestItemCollection {
    private map = new Map<string, vscode.TestItem>()
    get size() {
        return this.map.size
    }
    replace(items: readonly vscode.TestItem[]): void {
        this.map.clear()
        for (const item of items) {
            this.map.set(item.id, item)
        }
    }
    forEach(callback: (item: vscode.TestItem, collection: vscode.TestItemCollection) => unknown, _thisArg?: any): void {
        this.map.forEach((item) => callback(item, this))
    }
    add(item: vscode.TestItem): void {
        this.map.set(item.id, item)
    }
    delete(itemId: string): void {
        this.map.delete(itemId)
    }
    get(itemId: string): vscode.TestItem | undefined {
        return this.map.get(itemId)
    }
    [Symbol.iterator](): Iterator<[id: string, testItem: vscode.TestItem], any, any> {
        return this.map[Symbol.iterator]()
    }
}

export const mockCreateTestItem = vi.fn((id: string, label: string, uri: vscode.Uri) => {
    return {
        id,
        label,
        uri,
        sortText: undefined,
        children: new MockTestItemCollection(),
    }
})
