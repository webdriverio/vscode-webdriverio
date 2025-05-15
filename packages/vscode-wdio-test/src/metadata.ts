import type { MetadataRepositoryInterface, TestItemMetadata } from '@vscode-wdio/types/test'
import type * as vscode from 'vscode'

export class MetadataRepository implements MetadataRepositoryInterface {
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

    public setMetadata(testItem: vscode.TestItem, metadata: TestItemMetadata) {
        MetadataRepository.testMetadataRepository.set(testItem, metadata)
    }
}
