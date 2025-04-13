export const EXTENSION_ID = 'webdriverio'

export const DEFAULT_CONFIG_VALUES = {
    configPath: 'wdio.conf.js',
    testFilePattern: '**/*.spec.js,**/*.test.js,**/*.spec.ts,**/*.test.ts',
    showOutput: true,
} as const
