import { vi } from 'vitest'

import { RepositoryManager } from '../src/test/manager.js'
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
        children: {
            forEach: vi.fn(),
        } as unknown as vscode.TestItemCollection,
        canResolveChildren: false,
        busy: false,
        parent,
        range: {
            start: { line: 10, character: 0 },
            end: { line: 20, character: 0 },
        },
    } as unknown as vscode.TestItem

    RepositoryManager.setMetadata(testItem, _metadata)
    return testItem
}
