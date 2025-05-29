import * as path from 'node:path'

import { minVersion } from 'semver'

import pkg from '../packages/vscode-webdriverio/package.json' with { type: 'json' }

const target = process.env.VSCODE_WDIO_E2E_FRAMEWORK || 'mocha'

const minimumVersion = minVersion(pkg.engines.vscode )?.version || 'stable'

const version = process.env.VSCODE_WDIO_E2E_COMPATIBILITY_MODE === 'yes'
    ? minimumVersion
    :'stable'

const specs = target === 'cucumber' ? ['./tests/basicCucumber.spec.ts'] : ['./tests/basic.spec.ts']

export const config: WebdriverIO.Config = {
    runner: 'local',
    tsConfigPath: './tsconfig.json',
    specs,
    maxInstances: 10,
    capabilities: [
        {
            browserName: 'vscode',
            browserVersion: version,
            'wdio:vscodeOptions': {
                // points to directory where extension package.json is located
                extensionPath: path.resolve('../packages/vscode-webdriverio'),
                // optional VS Code settings
                userSettings: {
                    'webdriverio.logLevel': 'trace',
                },
                workspacePath: path.resolve(`../samples/e2e/${target}`),
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
