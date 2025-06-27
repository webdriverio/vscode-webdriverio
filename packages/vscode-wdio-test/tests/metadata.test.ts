import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as vscode from 'vscode'

import { mockCreateTestItem } from '../../../tests/utils.js'
import { MetadataRepository } from '../src/metadata.js'

vi.mock('vscode', async () => import('../../../tests/__mocks__/vscode.cjs'))

vi.mock('@vscode-wdio/logger', () => import('../../../tests/__mocks__/logger.js'))

describe('MetadataRepository', () => {
    let repo: MetadataRepository
    const mockUri = vscode.Uri.file('/path/to/dummy')

    const testItem = mockCreateTestItem('dummy', mockUri.fsPath, mockUri) as unknown as vscode.TestItem

    beforeEach(() => {
        repo = new MetadataRepository()
    })

    it('should create proper metadata for workspace', () => {
        repo.createWorkspaceMetadata(testItem, { uri: mockUri })
        const metadata = repo.getMetadata(testItem)

        expect(metadata.uri).toBe(mockUri)
        expect(metadata.isWorkspace).toBe(true)
        expect(metadata.isConfigFile).toBe(false)
        expect(metadata.isSpecFile).toBe(false)
        expect(metadata.isTestcase).toBe(false)
    })

    it('should create proper metadata for WdioConfigFile', () => {
        const dummyRepo = {} as any
        const dummyProfiles = [] as any
        repo.createWdioConfigFileMetadata(testItem, { repository: dummyRepo, uri: mockUri, runProfiles: dummyProfiles })
        const metadata = repo.getMetadata(testItem)

        expect(metadata.uri).toBe(mockUri)
        expect(metadata.repository).toBe(dummyRepo)
        expect(metadata.runProfiles).toBe(dummyProfiles)
        expect(metadata.isWorkspace).toBe(false)
        expect(metadata.isConfigFile).toBe(true)
        expect(metadata.isSpecFile).toBe(false)
        expect(metadata.isTestcase).toBe(false)
    })

    it('should create proper metadata for SpecFile', () => {
        const dummyRepo = {} as any
        repo.createSpecFileMetadata(testItem, { repository: dummyRepo, uri: mockUri })
        const metadata = repo.getMetadata(testItem)

        expect(metadata.uri).toBe(mockUri)
        expect(metadata.repository).toBe(dummyRepo)
        expect(metadata.isWorkspace).toBe(false)
        expect(metadata.isConfigFile).toBe(false)
        expect(metadata.isSpecFile).toBe(true)
        expect(metadata.isTestcase).toBe(false)
    })

    it('should create proper metadata for Testcase', () => {
        const dummyRepo = {} as any
        repo.createTestMetadata(testItem, { repository: dummyRepo, uri: mockUri, testType: 'test' })
        const metadata = repo.getMetadata(testItem)

        expect(metadata.uri).toBe(mockUri)
        expect(metadata.repository).toBe(dummyRepo)
        expect(metadata.type).toBe('test')
        expect(metadata.isWorkspace).toBe(false)
        expect(metadata.isConfigFile).toBe(false)
        expect(metadata.isSpecFile).toBe(false)
        expect(metadata.isTestcase).toBe(true)
    })

    it('should get same metadata from different repository instance', () => {
        const dummyRepo = {} as any
        const otherRepo = new MetadataRepository()

        repo.createSpecFileMetadata(testItem, { repository: dummyRepo, uri: mockUri })
        const metadata1 = repo.getMetadata(testItem)
        const testRepo1 = repo.getRepository(testItem)

        const metadata2 = otherRepo.getMetadata(testItem)
        const testRepo2 = otherRepo.getRepository(testItem)

        expect(metadata1).toBe(metadata2)
        expect(testRepo1).toBe(testRepo2)
    })
})
