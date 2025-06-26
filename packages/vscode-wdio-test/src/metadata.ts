import type { ITestRepository, TestItemMetadata, TestType } from '@vscode-wdio/types/test'
import type * as vscode from 'vscode'

export class MetadataRepository {
    private static testMetadataRepository = new WeakMap<vscode.TestItem, TestItemMetadata>()
    public getMetadata(testItem: vscode.TestItem) {
        const metadata = MetadataRepository.testMetadataRepository.get(testItem)
        if (!metadata) {
            throw new Error("The metadata for TestItem is not set. This is extension's bug.")
        }
        return metadata
    }

    public getRepository(testItem: vscode.TestItem) {
        const metadata = this.getMetadata(testItem)
        if (!metadata.repository) {
            throw new Error("The metadata for TestItem is not set. This is extension's bug.")
        }
        return metadata.repository
    }

    protected setMetadata(testItem: vscode.TestItem, metadata: TestItemMetadata) {
        MetadataRepository.testMetadataRepository.set(testItem, metadata)
    }

    public createTestMetadata(
        testItem: vscode.TestItem,
        options: { uri: vscode.Uri; repository: ITestRepository; testType: TestType }
    ) {
        this.setMetadata(testItem, {
            uri: options.uri,
            isWorkspace: false,
            isConfigFile: false,
            isSpecFile: false,
            isTestcase: true,
            repository: options.repository,
            type: options.testType,
        })
    }

    public createSpecFileMetadata(
        testItem: vscode.TestItem,
        options: { repository: ITestRepository; uri: vscode.Uri }
    ) {
        this.setMetadata(testItem, {
            uri: options.uri,
            isWorkspace: false,
            isConfigFile: false,
            isSpecFile: true,
            isTestcase: false,
            repository: options.repository,
        })
    }
    public createWdioConfigFileMetadata(
        testItem: vscode.TestItem,
        options: { repository: ITestRepository; uri: vscode.Uri; runProfiles?: vscode.TestRunProfile[] }
    ) {
        this.setMetadata(testItem, {
            uri: options.uri,
            isWorkspace: false,
            isConfigFile: true,
            isSpecFile: false,
            isTestcase: false,
            repository: options.repository,
            runProfiles: options.runProfiles,
        })
    }

    public createWorkspaceMetadata(testItem: vscode.TestItem, options: { uri: vscode.Uri }) {
        this.setMetadata(testItem, {
            uri: options.uri,
            isWorkspace: true,
            isConfigFile: false,
            isSpecFile: false,
            isTestcase: false,
        })
    }
}
