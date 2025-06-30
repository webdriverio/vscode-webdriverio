import type * as vscode from 'vscode'
import type { IExtensionConfigManager } from './config.js'
import type { IWdioExtensionWorker } from './server.js'

export interface IRepositoryManager extends vscode.Disposable, IMetadataRepositoryReader {
    readonly controller: vscode.TestController
    readonly configManager: IExtensionConfigManager
    readonly repos: ITestRepository[]

    initialize(): Promise<void>
    addWdioConfig(workspaceUri: vscode.WorkspaceFolder, wdioConfigPath: string): Promise<void>
    removeWdioConfig(workspaceFolder: vscode.WorkspaceFolder, wdioConfigPath: string): void
    registerToTestController(): void
    refreshTests(): Promise<void>
}

export interface ITestRepository extends vscode.Disposable, IMetadataRepositoryReader {
    readonly controller: vscode.TestController
    readonly wdioConfigPath: string
    specPatterns: string[]
    framework: string
    getWorker(): Promise<IWdioExtensionWorker>
    discoverAllTests(): Promise<void>
    reloadSpecFiles(filePaths?: string[]): Promise<void>
    removeSpecFile(specPath: string): void
    getSpecByFilePath(specPath: string): vscode.TestItem | undefined
}

export type TestResult = {
    name: string
    start: string
    end: string
    duration: number
    state: 'passed' | 'failed'
}

export type TestResults = TestResult[]

export interface SourcePosition {
    line: number
    column: number
}

export interface SourceRange {
    start: SourcePosition
    end: SourcePosition
}

export type TestType =
    | 'describe'
    | 'it'
    | 'test'
    | 'before'
    | 'after'
    | 'beforeEach'
    | 'afterEach'
    | 'feature'
    | 'scenario'
    | 'step'
    | 'scenarioOutline'
    | 'background'
    | 'examples'
    | 'rule'

/**
 * TestCase information interface
 */
export interface TestData {
    type: TestType
    name: string
    range: SourceRange
    children: TestData[]
    // Optional fields for future extensions
    metadata?: Record<string, unknown>
}

export type TestItemMetadata = {
    uri: vscode.Uri
    isWorkspace: boolean
    isConfigFile: boolean
    isSpecFile: boolean
    isTestcase: boolean
    repository?: ITestRepository // only workspace dose not have repository
    runProfiles?: vscode.TestRunProfile[]
    type?: TestType
}

export type TestItemMetadataWithRepository = Omit<TestItemMetadata, 'repository'> &
    Required<Pick<TestItemMetadata, 'repository'>>

export interface IMetadataRepositoryReader {
    getMetadata(testItem: vscode.TestItem): TestItemMetadata
    getRepository(testItem: vscode.TestItem): ITestRepository
}

export interface IMetadataRepository extends IMetadataRepositoryReader {
    setMetadata(testItem: vscode.TestItem, metadata: TestItemMetadata): void
}
