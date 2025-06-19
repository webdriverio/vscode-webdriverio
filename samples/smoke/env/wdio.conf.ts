import '@wdio/types'

const specs = process.env.SMOKE_TEST_SCENARIO === 'ENABLED' ? ['tests/enableEnv.spec.ts'] : ['tests/disableEnv.spec.ts']

export const config: WebdriverIO.Config = {
    runner: 'local',
    tsConfigPath: './tsconfig.json',

    specs,
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
    framework: 'mocha',

    reporters: ['spec'],

    mochaOpts: {
        ui: 'bdd',
        timeout: 60000,
    },
}
