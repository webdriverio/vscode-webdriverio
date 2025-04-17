export interface WebDriverIOConfig {
    configPath: string
    testFilePattern: string
    showOutput: boolean
    logLevel: WdioLogLevel
}

export type WdioLogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'
