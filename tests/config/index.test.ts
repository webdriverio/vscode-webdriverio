import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'
import { ConfigParser } from '@wdio/config/node'
import { configManager } from '../../src/config/index.js'
import { DEFAULT_CONFIG_VALUES, EXTENSION_ID } from '../../src/constants.js'
import { findWdioConfig } from '../../src/config/find.js'
import { log } from '../../src/utils/logger.js'

// Mock dependencies
vi.mock('vscode', () => import('../__mocks__/vscode.js'))
vi.mock('@wdio/config/node')
vi.mock('../../src/config/find')
vi.mock('../../src/utils/logger', () => ({
    log: {
        debug: vi.fn(),
        warn: vi.fn(),
    },
}))

function createNewInstance() {
    const WdioConfig = (configManager as any).constructor
    return new WdioConfig()
}

describe('WdioConfig', () => {
    const mockWorkspacePath = '/mock/workspace'
    const mockConfigPath = '/mock/workspace/wdio.conf.js'

    beforeEach(() => {
        vi.resetAllMocks()
        // Setup default vscode configuration mocks
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
            get: vi.fn().mockImplementation((key) => {
                if (key === 'configPath') {
                    return DEFAULT_CONFIG_VALUES.configPath
                }
                if (key === 'testFilePattern') {
                    return DEFAULT_CONFIG_VALUES.testFilePattern
                }
                if (key === 'showOutput') {
                    return DEFAULT_CONFIG_VALUES.showOutput
                }
                return undefined
            }),
        } as any)
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('constructor', () => {
        it('should initialize with default config values', () => {
            // Execute (create a new instance for testing)
            const _instance = createNewInstance()
            // Verify
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(EXTENSION_ID)
            expect(configManager.globalConfig).toEqual(DEFAULT_CONFIG_VALUES)
        })

        it('should use custom config values when provided', () => {
            // Setup
            const customConfig = {
                configPath: 'custom/path',
                testFilePattern: '**/*.custom.spec.ts',
                showOutput: false,
            }

            vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
                get: vi.fn().mockImplementation((key) => {
                    if (key === 'configPath') {
                        return customConfig.configPath
                    }
                    if (key === 'testFilePattern') {
                        return customConfig.testFilePattern
                    }
                    if (key === 'showOutput') {
                        return customConfig.showOutput
                    }
                    return undefined
                }),
            } as any)

            // Execute (create a new instance for testing)
            const WdioConfig = (configManager as any).constructor
            const instance = new WdioConfig()

            // Verify
            expect(instance.globalConfig).toEqual(customConfig)
        })
    })

    describe('listener', () => {
        it('should do nothing if event does not affect extension config', () => {
            // Setup
            const mockEvent = {
                affectsConfiguration: vi.fn().mockReturnValue(false),
            } as any

            // Execute
            configManager.listener(mockEvent)

            // Verify
            expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith(EXTENSION_ID)
            expect(vscode.workspace.getConfiguration).not.toHaveBeenCalled()
        })

        it('should update config values when event affects extension config', () => {
            // Setup
            const mockEvent = {
                affectsConfiguration: vi.fn().mockImplementation((key) => {
                    if (key === EXTENSION_ID) {
                        return true
                    }
                    if (key === `${EXTENSION_ID}.configPath`) {
                        return true
                    }
                    return false
                }),
            } as any

            const newConfigPath = 'updated/config/path'
            vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
                get: vi.fn().mockImplementation((key) => {
                    if (key === 'configPath') {
                        return newConfigPath
                    }
                    return undefined
                }),
            } as any)

            // Execute
            configManager.listener(mockEvent)

            // Verify
            expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith(EXTENSION_ID)
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(EXTENSION_ID)
            expect(log.debug).toHaveBeenCalledWith('The configuration for this extension were updated.')
            expect(log.debug).toHaveBeenCalledWith(`Update configPath: ${newConfigPath}`)
            expect(configManager.globalConfig.configPath).toBe(newConfigPath)
        })
    })

    describe('getWdioConfig', () => {
        it('should return cached config if available and reload is false', async () => {
            // Setup
            const mockConfigParser = {} as ConfigParser
            // Set cached config for testing
            ;(configManager as any)._configParser.set(mockWorkspacePath, mockConfigParser)

            // Execute
            const result = await configManager.getWdioConfig(mockWorkspacePath, false)

            // Verify
            expect(result).toBe(mockConfigParser)
            expect(findWdioConfig).not.toHaveBeenCalled()
        })

        it('should find and initialize new config when no cache or reload is true', async () => {
            // Setup
            const mockConfigParser = {
                initialize: vi.fn().mockResolvedValue(undefined),
            } as any

            vi.mocked(findWdioConfig).mockResolvedValue(mockConfigPath)
            vi.mocked(ConfigParser).mockImplementation(() => mockConfigParser)

            // Execute
            const result = await configManager.getWdioConfig(mockWorkspacePath, true)

            // Verify
            expect(findWdioConfig).toHaveBeenCalledWith(mockWorkspacePath)
            expect(ConfigParser).toHaveBeenCalledWith(mockConfigPath)
            expect(mockConfigParser.initialize).toHaveBeenCalled()
            expect(result).toBe(mockConfigParser)
        })

        it('should handle case when no config file is found', async () => {
            // Setup
            vi.mocked(findWdioConfig).mockResolvedValue(undefined)

            // Execute
            const result = await configManager.getWdioConfig(mockWorkspacePath, true)

            // Verify
            expect(findWdioConfig).toHaveBeenCalledWith(mockWorkspacePath)
            expect(result).toBeUndefined()
        })
    })

    describe('getWorkspaceFolderPath', () => {
        it('should return empty array when no workspace folders are available', () => {
            // Execute
            const result = configManager.getWorkspaceFolderPath(undefined)

            // Verify
            expect(result).toEqual([])
            expect(log.debug).toHaveBeenCalledWith('No workspace is detected.')
        })

        it('should return array with single workspace path when one workspace is available', () => {
            // Execute
            const result = configManager.getWorkspaceFolderPath([
                { uri: { fsPath: mockWorkspacePath } },
            ] as unknown as vscode.WorkspaceFolder[])

            // Verify
            expect(result).toEqual([mockWorkspacePath])
            expect(log.debug).toHaveBeenCalledWith(`Detected workspace path: ${mockWorkspacePath}`)
        })

        it('should return empty array and warn when multiple workspaces are available', () => {
            // Execute
            const result = configManager.getWorkspaceFolderPath([
                { uri: { fsPath: '/workspace1' } },
                { uri: { fsPath: '/workspace2' } },
            ] as unknown as vscode.WorkspaceFolder[])

            // Verify
            expect(result).toEqual([])
            expect(log.debug).toHaveBeenCalledWith('Detected 2 workspaces.')
            expect(log.warn).toHaveBeenCalledWith('Not support the multiple workspaces')
        })
    })
})
