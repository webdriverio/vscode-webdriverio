import type { MatcherContext } from 'expect'
import type { TreeItem } from 'wdio-vscode-service'
import type { STATUS } from '../helpers.js'

export interface ExpectedTreeItem {
    label: string
    status: StatusStrings
    children?: ExpectedTreeItem[]
}

export type StatusStrings = (typeof STATUS)[keyof typeof STATUS]

class MismatchTreeStructureError extends Error {
    constructor(public assertionMessage: () => string) {
        super('Mismatch')
    }
}

async function expectTreeToMatchStructure(
    this: MatcherContext,
    receivedTree: TreeItem[],
    expectedTree: ExpectedTreeItem[],
    level = 0,
    index = 0
) {
    try {
        if (expectedTree.length !== receivedTree.length) {
            throw new MismatchTreeStructureError(
                () =>
                    `Mismatch the number of items at (${index} : ${level})` +
                    `  Expected: ${this.utils.printExpected(expectedTree.length)}` +
                    `  Received: ${this.utils.printReceived(receivedTree.length)}`
            )
        }

        for (const [index, item] of Object.entries(receivedTree)) {
            const rootLabel = await item.getLabel()

            const expectItem = expectedTree[Number(index)]
            const labelRegex = new RegExp(expectItem.label)
            if (!labelRegex.test(rootLabel)) {
                throw new MismatchTreeStructureError(
                    () =>
                        `Mismatch the label of items at (${index} : ${level})` +
                        `  Expected: ${this.utils.printExpected(expectItem.label)}` +
                        `  Received: ${this.utils.printReceived(rootLabel)}`
                )
            }
            const receivedStatus = rootLabel.match(/\(([^)]+)\)/)
            if (!receivedStatus || receivedStatus[1] !== expectItem.status) {
                throw new MismatchTreeStructureError(
                    () =>
                        `Mismatch the status of items at (${index} : ${level})` +
                        `  Expected: ${this.utils.printExpected(expectItem.status)}` +
                        `  Received: ${this.utils.printReceived(receivedStatus![1])}` +
                        ` (${rootLabel})`
                )
            }

            if (!(await item.isExpanded())) {
                await item.expand()
            }

            const children = await item.getChildren()
            const expectedChildren = expectItem.children
            if (children && expectedChildren) {
                await expectTreeToMatchStructure.call(this, children, expectedChildren, level + 1, Number(index))
            }
        }
        return {
            pass: true,
            message: () => 'All ok.',
        }
    } catch (error) {
        if (level > 0) {
            throw error
        }
        const message = error instanceof MismatchTreeStructureError ? error.assertionMessage : () => String(error)
        return {
            pass: false,
            message,
        }
    }
}

try {
    if (typeof expect !== 'undefined' && expect.extend) {
        expect.extend({
            async toMatchTreeStructure(tree: TreeItem[], expectedStructure: ExpectedTreeItem[]) {
                return await expectTreeToMatchStructure.call(this as unknown as MatcherContext, tree, expectedStructure)
            },
        })
    }
} catch (error) {
    console.warn('Failed to extend expect:', error)
}
