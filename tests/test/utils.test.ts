import { describe, expect, it, vi, beforeEach } from 'vitest'

import * as utils from '../../src/test/utils.js'

import type * as vscode from 'vscode'
import type { RepositoryManager } from '../../src/test/manager.js'

vi.mock('vscode', async () => {
    const mockVscode = await import('../__mocks__/vscode.cjs')
    return {
        ...mockVscode,
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
            } as unknown as vscode.TestItem
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

    describe('getRootTestItem', ()=>{
        const rootTestItem = {
            id:'root',
            parent:undefined
        } as unknown as vscode.TestItem
        const l1TestItem ={
            id:'l1',
            parent: rootTestItem
        } as unknown as vscode.TestItem
        const l2TestItem ={
            id:'l2',
            parent: l1TestItem
        } as unknown as vscode.TestItem

        it('should return root TestItem when input the ground child item', ()=>{
            const result = utils.getRootTestItem(l2TestItem)
            expect(result.id).toBe(rootTestItem.id)
        })

        it('should return root TestItem when input the child item2', ()=>{
            const result = utils.getRootTestItem(l1TestItem)
            expect(result.id).toBe(rootTestItem.id)
        })

        it('should return root TestItem when input the root item itself', ()=>{
            const result = utils.getRootTestItem(rootTestItem)
            expect(result.id).toBe(rootTestItem.id)
        })
    })
})
