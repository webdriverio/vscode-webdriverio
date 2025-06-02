import * as path from 'node:path'
import * as url from 'node:url'

import { minVersion } from 'semver'

import pkg from '../packages/vscode-webdriverio/package.json' with { type: 'json' }

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const target = process.env.VSCODE_WDIO_E2E_FRAMEWORK || 'mocha'

const minimumVersion = minVersion(pkg.engines.vscode)?.version || 'stable'

const isCompatibilityMode = process.env.VSCODE_WDIO_E2E_COMPATIBILITY_MODE === 'yes'
const version = isCompatibilityMode ? minimumVersion : 'stable'

const outputDir = path.join(__dirname, 'logs', [isCompatibilityMode ? 'compatibility' : 'e2e', target].join('-'))
process.env.VSCODE_WDIO_TRACE_LOG_PATH = outputDir

const specs = target === 'cucumber' ? ['./tests/basicCucumber.spec.ts'] : ['./tests/basic.spec.ts']

export function createBaseConfig(workspacePath: string): WebdriverIO.Config {
    return {
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
                    workspacePath: path.resolve(workspacePath),
                },
                'wdio:enforceWebDriverClassic': true,
            },
        ],

        logLevel: 'debug',
        outputDir,
        bail: 0,
        waitforTimeout: 120000,
        connectionRetryTimeout: 120000,
        connectionRetryCount: 3,
        services: [['vscode', { cachePath: path.join(__dirname, '.wdio-vscode-service') }]],
        framework: 'mocha',
        reporters: ['spec'],
        mochaOpts: {
            ui: 'bdd',
            timeout: 6000000,
            require: ['assertions/index.ts'],
        },
    }
}

export const config: WebdriverIO.Config = {
    ...createBaseConfig(`../samples/e2e/${target}`),
    specs,
}
