export const EXTENSION_ID = 'webdriverio'

export const DEFAULT_CONFIG_VALUES = {
    configPath: 'wdio.conf.js',
    testFilePattern: '**/*.spec.js,**/*.test.js,**/*.spec.ts,**/*.test.ts,**/*.feature',
    showOutput: true,
} as const

export const TEST_ID_SEPARATOR = '#WDIO_SEP#'

export const ERROR_MESSAGE_BUG = 'Please report this bug to the WebDriverIO extension repository.'

export enum LOG_LEVEL {
    TRACE = 0,
    DEBUG = 1,
    INFO = 2,
    WARN = 3,
    ERROR = 4,
    SILENT = 5,
}
