import '@wdio/types'
export const config: WebdriverIO.Config = {
    runner: 'local',
    tsConfigPath: './tsconfig.json',

    specs: ['tests/*.spec.ts'],
    exclude: [],
    maxInstances: 10,
    capabilities: [
        {
            browserName: 'chrome',
        },
    ],

    logLevel: 'info',
    bail: 0,
    waitforTimeout: 10000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    framework: 'jasmine',

    reporters: ['spec'],

    jasmineOpts: {
        defaultTimeoutInterval: 60000,
    },
}
