/* c8 ignore start */
export interface WebdriverIOConfig {
    nodeExecutable: string | undefined
    configFilePattern: string[]
    workerIdleTimeout: number
    showOutput: boolean
    logLevel: string
}

export const EXTENSION_ID = 'webdriverio'

export const DEFAULT_CONFIG_VALUES: WebdriverIOConfig = {
    nodeExecutable: undefined,
    configFilePattern: ['**/*wdio*.conf*.{ts,js,mjs,cjs,cts,mts}'],
    workerIdleTimeout: 600,
    showOutput: true,
    logLevel: 'info',
} as const

export const TEST_ID_SEPARATOR = '#WDIO_SEP#'

export const ERROR_MESSAGE_BUG = 'Please report this bug to the WebdriverIO extension repository.'

export enum LOG_LEVEL {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    SILENT = 5,
}
/* c8 ignore stop */
