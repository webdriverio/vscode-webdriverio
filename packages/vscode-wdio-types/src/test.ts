import type * as vscode from 'vscode'
import type { WdioExtensionWorkerInterface } from './api.js'
import type { ExtensionConfigManagerInterface } from './config.js'

export interface RepositoryManagerInterface extends vscode.Disposable {
    readonly controller: vscode.TestController
    readonly configManager: ExtensionConfigManagerInterface
    readonly repos: TestRepositoryInterface[]

    initialize(): Promise<void>
    addWdioConfig(workspaceUri: vscode.Uri, wdioConfigPath: string): Promise<void>
    removeWdioConfig(workspaceUri: vscode.Uri, wdioConfigPath: string): void
    registerToTestController(): void
    refreshTests(): Promise<void>
}

export interface TestRepositoryInterface extends MetadataRepositoryInterface, vscode.Disposable {
    readonly controller: vscode.TestController
    readonly worker: WdioExtensionWorkerInterface
    readonly wdioConfigPath: string
    specPatterns: string[]
    framework: string
    discoverAllTests(): Promise<void>
    reloadSpecFiles(filePaths?: string[]): Promise<void>
    removeSpecFile(specPath: string): void
    clearTests(): void
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

export type VscodeTestData = Omit<TestData, 'range' | 'children'> & {
    uri: vscode.Uri
    range: vscode.Range
    children: VscodeTestData[]
}

export type TestItemMetadata = {
    uri: vscode.Uri
    isWorkspace: boolean
    isConfigFile: boolean
    isSpecFile: boolean
    isTestcase: boolean
    repository?: TestRepositoryInterface // only workspace dose not have repository
    runProfiles?: vscode.TestRunProfile[]
    type?: TestType
}

export type TestItemMetadataWithRepository = Omit<TestItemMetadata, 'repository'> &
    Required<Pick<TestItemMetadata, 'repository'>>

export interface MetadataRepositoryInterface {
    getMetadata(testItem: vscode.TestItem): TestItemMetadata
    getRepository(testItem: vscode.TestItem): TestRepositoryInterface
    setMetadata(testItem: vscode.TestItem, metadata: TestItemMetadata): void
}
