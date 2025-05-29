import * as path from 'node:path'

const specs = ['./tests/updateConfig.spec.ts']

export const config: WebdriverIO.Config = {
    runner: 'local',
    tsConfigPath: './tsconfig.json',
    specs,
    maxInstances: 10,
    capabilities: [
        {
            browserName: 'vscode',
            browserVersion: 'stable', // also possible: "insiders" or a specific version e.g. "1.80.0"
            'wdio:vscodeOptions': {
                // points to directory where extension package.json is located
                extensionPath: path.resolve('../packages/vscode-webdriverio'),
                // optional VS Code settings
                userSettings: {
                    'webdriverio.logLevel': 'trace',
                },
                workspacePath: path.resolve('../samples/smoke/update-config'),
            },
            'wdio:enforceWebDriverClassic': true,
        },
    ],

    logLevel: 'debug',
    outputDir: 'logs',
    bail: 0,
    waitforTimeout: 120000,
    connectionRetryTimeout: 120000,
    connectionRetryCount: 3,
    services: ['vscode'],
    framework: 'mocha',
    reporters: ['spec'],
    mochaOpts: {
        ui: 'bdd',
        timeout: 6000000,
        require: ['assertions/index.ts'],
    },
}
