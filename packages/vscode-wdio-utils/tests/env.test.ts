import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { beforeEach, describe, expect, it } from 'vitest'

import { getEnvOptions } from '../src/env.js'
import type { IExtensionConfigManager, WebdriverIOConfig } from '@vscode-wdio/types'
import type * as vscode from 'vscode'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(__dirname, '__fixtures__')

const globalEnv = path.resolve(fixturesDir, '.env')
const localEnv = path.resolve(fixturesDir, '.env.local')

describe('getEnvOptions', () => {
    let mockConfigManager: IExtensionConfigManager
    let mockWorkspaceFolder: vscode.WorkspaceFolder

    beforeEach(() => {
        mockConfigManager = {
            globalConfig: {},
        } as unknown as IExtensionConfigManager

        mockWorkspaceFolder = {
            uri: {
                fsPath: fixturesDir,
            } as unknown as vscode.Uri,
        } as unknown as vscode.WorkspaceFolder
    })

    it('should resolve absolute path when input relative path', async () => {
        mockConfigManager.globalConfig = {
            envFiles: ['.env', '.env.local'],
            overrideEnv: true,
        } as WebdriverIOConfig

        const result = await getEnvOptions(mockConfigManager, mockWorkspaceFolder)

        expect(result).toStrictEqual({
            override: true,
            paths: [globalEnv, localEnv],
        })
    })

    it('should resolve absolute path when input absolute path', async () => {
        mockConfigManager.globalConfig = {
            envFiles: [globalEnv, '.env.local'],
            overrideEnv: true,
        } as WebdriverIOConfig

        const result = await getEnvOptions(mockConfigManager, mockWorkspaceFolder)

        expect(result).toStrictEqual({
            override: true,
            paths: [globalEnv, localEnv],
        })
    })

    it('should return only existing env files', async () => {
        mockConfigManager.globalConfig = {
            envFiles: [globalEnv, '.env.notfound'],
            overrideEnv: false,
        } as WebdriverIOConfig

        const result = await getEnvOptions(mockConfigManager, mockWorkspaceFolder)

        expect(result).toStrictEqual({
            override: false,
            paths: [globalEnv],
        })
    })
})
