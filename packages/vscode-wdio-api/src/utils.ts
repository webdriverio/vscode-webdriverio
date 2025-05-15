import { LOG_LEVEL, TEST_ID_SEPARATOR } from '@vscode-wdio/constants'
import { log } from '@vscode-wdio/logger'
import { WebSocketServer } from 'ws'

import type { Server } from 'node:http'
import type { TestItemMetadataWithRepository } from '@vscode-wdio/types/test'
import type { NumericLogLevel } from '@vscode-wdio/types/utils'
import type * as vscode from 'vscode'

export async function loggingFn(_logLevel: NumericLogLevel, message: string) {
    switch (_logLevel) {
        case LOG_LEVEL.TRACE:
            log.trace(message)
            break
        case LOG_LEVEL.DEBUG:
            log.debug(message)
            break
        case LOG_LEVEL.ERROR:
            log.error(message)
            break
        case LOG_LEVEL.WARN:
            log.warn(message)
            break
        case LOG_LEVEL.INFO:
            log.info(message)
            break
        default:
            log.debug(message)
            break
    }
}

export function createWss(server: Server) {
    return new WebSocketServer({ server })
}

export function getSpec(tests: vscode.TestItem) {
    const testPath = tests.uri?.fsPath
    return testPath ? [testPath] : undefined
}

export function getGrep(test: vscode.TestItem) {
    const testNames = test.id.split(TEST_ID_SEPARATOR)
    // Escape following characters
    // $, ^, ., *, +, ?, (, ), [, ], {, }, |, \
    return testNames[testNames.length - 1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getRange(test: vscode.TestItem) {
    const isEmptyRange = !test.range || test.range.isEmpty
    return isEmptyRange ? undefined : test.range
}

export function getCucumberSpec(testItem: vscode.TestItem, metadata: TestItemMetadataWithRepository) {
    const baseSpec = getSpec(testItem)
    if (!baseSpec) {
        return undefined
    }
    if (metadata.type === 'rule') {
        const specs = []
        for (const [_, childItem] of testItem.children) {
            const childeMetadata = metadata.repository.getMetadata(childItem)
            if (childeMetadata.type === 'scenario') {
                const start = childItem.range?.start.line || 0
                const end = childItem.range?.end.line || 0
                if (start > 0 && end > 0) {
                    const spec = `${baseSpec}:${String(start + 1)}:${String(end + 1)}`
                    log.debug(`cucumber spec: ${spec}`)
                    specs.push(spec)
                }
            }
        }
        if (specs.length > 0) {
            return specs
        }
    }

    if (metadata.type === 'scenario') {
        const specs = []
        const start = testItem.range?.start.line || 0
        const end = testItem.range?.end.line || 0
        if (start > 0 && end > 0) {
            const spec = `${baseSpec}:${String(start + 1)}:${String(end + 1)}`
            specs.push(spec)
        }
        if (specs.length > 0) {
            log.debug(`cucumber spec: ${specs}`)
            return specs
        }
    }
    return baseSpec
}
