import { normalize } from 'node:path'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as vscode from 'vscode'

import { findWdioConfig } from '../../src/config/find.js'
import { ExtensionConfigManager } from '../../src/config/index.js'
import { DEFAULT_CONFIG_VALUES, EXTENSION_ID } from '../../src/constants.js'
import { log } from '../../src/utils/logger.js'

import type { MockWorkspace } from 'jest-mock-vscode'

// Mock dependencies
vi.mock('vscode', async () => import('../__mocks__/vscode.cjs'))
vi.mock('../../src/utils/logger.js', () => import('../__mocks__/logger.js'))
vi.mock('../../src/config/find.js')
vi.mock('../../src/config/watcher.js', () => ({}))
vi.mock('node:events', () => {
    const EventEmitter = vi.fn()
    EventEmitter.prototype.emit = vi.fn()
    return { EventEmitter }
})

describe('ExtensionConfigManager', () => {
    let configManager: ExtensionConfigManager
    const mockConfiguration = {
        get: vi.fn(),
    }

    beforeEach(() => {
        vi.resetAllMocks()

        // Setup default vscode configuration mocks
        vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfiguration as any)

        // Setup default configuration mock values
        mockConfiguration.get.mockImplementation((key, defaultValue) => {
            if (key === 'configFilePattern') {
                return DEFAULT_CONFIG_VALUES.configFilePattern
            }
            if (key === 'showOutput') {
                return DEFAULT_CONFIG_VALUES.showOutput
            }
            if (key === 'logLevel') {
                return DEFAULT_CONFIG_VALUES.logLevel
            }
            return defaultValue
        })

        configManager = new ExtensionConfigManager()
    })

    afterEach(() => {
        vi.clearAllMocks()
        configManager.dispose()
    })

    describe('constructor', () => {
        it('should initialize with default config values', () => {
            // Verify
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(EXTENSION_ID)
            expect(configManager.globalConfig).toEqual(DEFAULT_CONFIG_VALUES)
        })

        it('should use custom config values when provided', () => {
            // Setup
            const customConfigFilePattern = ['custom/path/wdio.*.conf.ts']
            const customShowOutput = false
            const customLogLevel = 'warn'

            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'configFilePattern') {
                    return customConfigFilePattern
                }
                if (key === 'showOutput') {
                    return customShowOutput
                }
                if (key === 'logLevel') {
                    return customLogLevel
                }
                return defaultValue
            })

            // Execute
            const instance = new ExtensionConfigManager()

            // Verify
            expect(instance.globalConfig).toEqual({
                configFilePattern: customConfigFilePattern,
                showOutput: customShowOutput,
                logLevel: customLogLevel,
            })
        })

        it('should use default values when config returns empty arrays', () => {
            // Setup
            mockConfiguration.get.mockImplementation((key, defaultValue) => {
                if (key === 'configFilePattern') {
                    return []
                }
                return defaultValue
            })

            // Execute
            const instance = new ExtensionConfigManager()

            // Verify
            expect(instance.globalConfig.configFilePattern).toEqual(DEFAULT_CONFIG_VALUES.configFilePattern)
        })
    })

    describe('listener', () => {
        it('should do nothing if event does not affect extension config', () => {
            // Setup
            const mockEvent = {
                affectsConfiguration: vi.fn().mockReturnValue(false),
            } as unknown as vscode.ConfigurationChangeEvent
            vi.resetAllMocks()

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
                    if (key === `${EXTENSION_ID}.configFilePattern`) {
                        return true
                    }
                    return false
                }),
            } as unknown as vscode.ConfigurationChangeEvent

            const newConfigFilePattern = ['updated/config/path/*.conf.js']
            mockConfiguration.get.mockImplementation((key) => {
                if (key === 'configFilePattern') {
                    return newConfigFilePattern
                }
                return undefined
            })

            // Setup spy on emit method
            const emitSpy = vi.spyOn(configManager as any, 'emit')

            // Execute
            configManager.listener(mockEvent)

            // Verify
            expect(mockEvent.affectsConfiguration).toHaveBeenCalledWith(EXTENSION_ID)
            expect(vscode.workspace.getConfiguration).toHaveBeenCalledWith(EXTENSION_ID)
            expect(log.debug).toHaveBeenCalledWith('The configuration for this extension were updated.')
            expect(log.debug).toHaveBeenCalledWith(`Update configFilePattern: ${newConfigFilePattern}`)
            expect(emitSpy).toHaveBeenCalledWith('update:configFilePattern', newConfigFilePattern)
            expect(configManager.globalConfig.configFilePattern).toEqual(newConfigFilePattern)
        })
    })

    describe('initialize', () => {
        it('should return empty array when no workspace folders', async () => {
            // Execute
            const result = await configManager.initialize()

            // Verify
            expect(result).toEqual([])
            expect(log.debug).toHaveBeenCalledWith('No workspace is detected.')
            expect(configManager.isMultiWorkspace).toBe(false)
        })

        it('should initialize workspaces and find config files', async () => {
            // Setup
            const mockWorkspaceFolder1 = { uri: vscode.Uri.file('/workspace1') } as vscode.WorkspaceFolder
            const mockWorkspaceFolder2 = { uri: vscode.Uri.file('/workspace2') } as vscode.WorkspaceFolder
            ;(vscode.workspace as MockWorkspace).setWorkspaceFolders([mockWorkspaceFolder1, mockWorkspaceFolder2])

            const wdioConfigFiles1 = ['/workspace1/wdio.conf.js', '/workspace1/wdio.e2e.conf.js']
            const wdioConfigFiles2 = ['/workspace2/wdio.conf.js']

            vi.mocked(findWdioConfig).mockResolvedValueOnce(wdioConfigFiles1).mockResolvedValueOnce(wdioConfigFiles2)

            // Execute
            await configManager.initialize()

            // Verify
            expect(configManager.isMultiWorkspace).toBe(true)
            expect(findWdioConfig).toHaveBeenCalledTimes(2)
            expect(findWdioConfig).toHaveBeenCalledWith(
                normalize('/workspace1'),
                DEFAULT_CONFIG_VALUES.configFilePattern
            )
            expect(findWdioConfig).toHaveBeenCalledWith(
                normalize('/workspace2'),
                DEFAULT_CONFIG_VALUES.configFilePattern
            )

            expect(configManager.workspaces).toEqual([
                {
                    workspaceFolder: mockWorkspaceFolder1,
                    wdioConfigFiles: wdioConfigFiles1,
                },
                {
                    workspaceFolder: mockWorkspaceFolder2,
                    wdioConfigFiles: wdioConfigFiles2,
                },
            ])
        })

        it('should handle workspaces with no config files', async () => {
            // Setup
            const mockWorkspaceFolder = { uri: vscode.Uri.file('/workspace') } as vscode.WorkspaceFolder
            ;(vscode.workspace as MockWorkspace).setWorkspaceFolders([mockWorkspaceFolder])

            vi.mocked(findWdioConfig).mockResolvedValueOnce([])

            // Execute
            await configManager.initialize()

            // Verify
            expect(configManager.isMultiWorkspace).toBe(false)
            expect(configManager.workspaces).toEqual([
                {
                    workspaceFolder: mockWorkspaceFolder,
                    wdioConfigFiles: [],
                },
            ])
        })
    })

    describe('getWdioConfigPaths', () => {
        it('should throw error when not initialized', () => {
            // Execute & Verify
            expect(() => configManager.getWdioConfigPaths()).toThrow('Configuration manager is not initialized')
        })

        it('should return all config paths after initialization', async () => {
            // Setup
            const mockWorkspaceFolder = { uri: vscode.Uri.file('/workspace') } as vscode.WorkspaceFolder
            ;(vscode.workspace as MockWorkspace).setWorkspaceFolders([mockWorkspaceFolder])

            const wdioConfigFiles = ['/workspace/wdio.conf.js', '/workspace/wdio.e2e.conf.js']
            vi.mocked(findWdioConfig).mockResolvedValueOnce(wdioConfigFiles)

            // Execute
            await configManager.initialize()
            const paths = configManager.getWdioConfigPaths()

            // Verify
            expect(paths).toEqual(wdioConfigFiles)
        })
    })

    describe('workspaces property', () => {
        it('should throw error when accessed before initialization', () => {
            // Execute & Verify
            expect(() => configManager.workspaces).toThrow('WdioConfig class is not initialized.')
        })
    })

    describe('dispose', () => {
        it('should clear workspaces data', async () => {
            await configManager.initialize()
            expect(configManager.workspaces).toBeDefined()

            // Execute
            configManager.dispose()

            // Verify
            expect(() => configManager.workspaces).toThrow('WdioConfig class is not initialized.')
        })
    })
})
