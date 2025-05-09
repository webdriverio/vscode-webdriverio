import { describe, expect, it, vi, beforeEach } from 'vitest'

import * as utils from '../../src/test/utils.js'

import type * as vscode from 'vscode'
import type { RepositoryManager } from '../../src/test/manager.js'
import type { WdioConfigTestItem, WdioTestItem } from '../../src/test/types.js'

vi.mock('vscode', async () => {
    return {
        TestRunProfileKind: {
            Run: 1,
        },
        tests: {
            createTestController: vi.fn(),
        },
    }
})

vi.mock('../../src/test/runHandler.js', () => {
    return {
        createHandler: vi.fn(() => {
            return () => {
                /* Dummy function */
            }
        }),
    }
})

// Mock for constants
vi.mock('../../src/constants.js', () => {
    return {
        EXTENSION_ID: 'webdriverio-vscode',
    }
})

describe('Test Utils', () => {
    describe('filterSpecsByPaths', () => {
        it('should filter specs correctly with exact path match', () => {
            // Setup test data
            const allSpecs = ['/path/to/spec1.js', '/path/to/subfolder/spec2.js', '/another/path/spec3.js']

            // Test exact match
            const result = utils.filterSpecsByPaths(allSpecs, ['/path/to/spec1.js'])
            expect(result).toEqual(['/path/to/spec1.js'])
        })

        it('should filter specs correctly with partial path match', () => {
            // Setup test data
            const allSpecs = ['/path/to/spec1.js', '/path/to/subfolder/spec2.js', '/another/path/spec3.js']

            // Test partial match - matching directory
            const result = utils.filterSpecsByPaths(allSpecs, ['/path/to'])
            expect(result).toEqual(['/path/to/spec1.js', '/path/to/subfolder/spec2.js'])
        })

        it('should return empty array when no match is found', () => {
            // Setup test data
            const allSpecs = ['/path/to/spec1.js', '/path/to/subfolder/spec2.js', '/another/path/spec3.js']

            // Test no match
            const result = utils.filterSpecsByPaths(allSpecs, ['/not/exist'])
            expect(result).toEqual([])
        })

        it('should handle array of filter paths', () => {
            // Setup test data
            const allSpecs = ['/path/to/spec1.js', '/path/to/subfolder/spec2.js', '/another/path/spec3.js']

            // Test multiple filter paths
            const result = utils.filterSpecsByPaths(allSpecs, ['/path/to/spec1.js', '/another/path'])
            expect(result).toContain('/path/to/spec1.js')
            expect(result).toContain('/another/path/spec3.js')
            expect(result).not.toContain('/path/to/subfolder/spec2.js')
        })

        it('should handle empty inputs gracefully', () => {
            // Empty specs array
            expect(utils.filterSpecsByPaths([], ['/some/path'])).toEqual([])

            // Empty filter paths array
            const allSpecs = ['/path/to/spec1.js', '/path/to/spec2.js']
            expect(utils.filterSpecsByPaths(allSpecs, [])).toEqual([])
        })
    })

    describe('Type guards', () => {
        // Mock for vscode.TestItem
        const createTestItem = (id: string, metadata: any = {}): vscode.TestItem => {
            return {
                id,
                label: id,
                uri: { fsPath: `/path/to/${id}` } as vscode.Uri,
                children: {} as vscode.TestItemCollection,
                canResolveChildren: false,
                busy: false,
                metadata,
            } as unknown as vscode.TestItem
        }

        describe('isWdioTestItem', () => {
            it('should return true if testItem has metadata not property', () => {
                const testItem = createTestItem('wdio-item', {
                    isWorkspace: false,
                    isConfigFile: false,
                    isSpecFile: false,
                })
                expect(utils.isWdioTestItem(testItem)).toBe(true)
            })

            it('should return false if testItem has metadata not property', () => {
                const testItem = createTestItem('wdio-item', { some: 'data' })
                expect(utils.isWdioTestItem(testItem)).toBe(false)
            })

            it('should return false if testItem has no metadata property', () => {
                const testItem = createTestItem('non-wdio-item')
                delete (testItem as any).metadata
                expect(utils.isWdioTestItem(testItem)).toBe(false)
            })
        })

        describe('isWorkspace', () => {
            it('should return true if testItem is a workspace item', () => {
                const testItem = createTestItem('workspace-item', {
                    isWorkspace: true,
                    isConfigFile: false,
                    isSpecFile: false,
                })
                expect(utils.isWorkspace(testItem as WdioTestItem)).toBe(true)
            })

            it('should return false if testItem is not a workspace item', () => {
                const testItem = createTestItem('non-workspace-item', { isWorkspace: false })
                expect(utils.isWorkspace(testItem as WdioTestItem)).toBe(false)
            })

            it('should return false if testItem has no workspace flag', () => {
                const testItem = createTestItem('item', { someOtherProp: true })
                expect(utils.isWorkspace(testItem as WdioTestItem)).toBe(false)
            })
        })

        describe('isConfig', () => {
            it('should return true if testItem is a config file item', () => {
                const testItem = createTestItem('config-item', {
                    isWorkspace: false,
                    isConfigFile: true,
                    isSpecFile: false,
                })
                expect(utils.isConfig(testItem as WdioTestItem)).toBe(true)
            })

            it('should return false if testItem is not a config file item', () => {
                const testItem = createTestItem('non-config-item', { isConfigFile: false })
                expect(utils.isConfig(testItem as WdioTestItem)).toBe(false)
            })

            it('should return false if testItem has no config file flag', () => {
                const testItem = createTestItem('item', { someOtherProp: true })
                expect(utils.isConfig(testItem as WdioTestItem)).toBe(false)
            })
        })

        describe('isSpec', () => {
            it('should return true if testItem is a spec file item', () => {
                const testItem = createTestItem('spec-item', {
                    isWorkspace: false,
                    isConfigFile: false,
                    isSpecFile: true,
                })
                expect(utils.isSpec(testItem as WdioTestItem)).toBe(true)
            })

            it('should return false if testItem is not a spec file item', () => {
                const testItem = createTestItem('non-spec-item', { isSpecFile: false })
                expect(utils.isSpec(testItem as WdioTestItem)).toBe(false)
            })

            it('should return false if testItem has no spec file flag', () => {
                const testItem = createTestItem('item', { someOtherProp: true })
                expect(utils.isSpec(testItem as WdioTestItem)).toBe(false)
            })
        })

        describe('isTestcase', () => {
            it('should return true if testItem is a testcase item', () => {
                const testItem = createTestItem('testcase-item', {
                    isWorkspace: false,
                    isConfigFile: false,
                    isSpecFile: false,
                })
                expect(utils.isTestcase(testItem as WdioTestItem)).toBe(true)
            })

            it('should return false if testItem is a workspace item', () => {
                const testItem = createTestItem('workspace-item', {
                    isWorkspace: true,
                    isConfigFile: false,
                    isSpecFile: false,
                })
                expect(utils.isTestcase(testItem as WdioTestItem)).toBe(false)
            })

            it('should return false if testItem is a config file item', () => {
                const testItem = createTestItem('config-item', {
                    isWorkspace: false,
                    isConfigFile: true,
                    isSpecFile: false,
                })
                expect(utils.isTestcase(testItem as WdioTestItem)).toBe(false)
            })

            it('should return false if testItem is a spec file item', () => {
                const testItem = createTestItem('spec-item', {
                    isWorkspace: false,
                    isConfigFile: false,
                    isSpecFile: true,
                })
                expect(utils.isTestcase(testItem as WdioTestItem)).toBe(false)
            })
        })
    })

    describe('createRunProfile', () => {
        let mockController: vscode.TestController
        let repositoryManager: RepositoryManager

        beforeEach(() => {
            // Set up mock controller
            mockController = {
                createRunProfile: vi.fn(),
            } as unknown as vscode.TestController
            repositoryManager = {
                controller: mockController,
            } as RepositoryManager
        })

        it('should create a run profile with correct parameters', () => {
            const wdioConfigFile = {
                uri: {
                    fsPath: 'file:///path/to/wdio.conf.js',
                },
                description: 'path/to',
            } as unknown as WdioConfigTestItem
            const isDefaultProfile = true

            utils.createRunProfile.call(repositoryManager, wdioConfigFile, isDefaultProfile)

            expect(mockController.createRunProfile).toHaveBeenCalledWith(
                'wdio.conf.js (path/to)',
                expect.any(Number),
                expect.any(Function),
                isDefaultProfile
            )
        })
    })
})
