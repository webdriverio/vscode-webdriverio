import * as path from 'node:path'
import * as url from 'node:url'

import { minVersion } from 'semver'

import pkg from '../packages/vscode-webdriverio/package.json' with { type: 'json' }
import type { Frameworks } from '@wdio/types'

type TestTargets = 'workspace' | 'mocha' | 'jasmine' | 'cucumber'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const target = (process.env.VSCODE_WDIO_E2E_FRAMEWORK || 'mocha') as TestTargets

const minimumVersion = minVersion(pkg.engines.vscode)?.version || 'stable'

const isCompatibilityMode = process.env.VSCODE_WDIO_E2E_COMPATIBILITY_MODE === 'yes'
const version = isCompatibilityMode ? minimumVersion : 'stable'

const outputDir = path.join(__dirname, 'logs', [isCompatibilityMode ? 'compatibility' : 'e2e', target].join('-'))
process.env.VSCODE_WDIO_TRACE_LOG_PATH = outputDir

function defineSpecs(target: TestTargets) {
    switch (target) {
        case 'cucumber':
            return ['./tests/basicCucumber.spec.ts']
        case 'workspace':
            return ['./tests/basicWorkspace.spec.ts']
        default:
            return ['./tests/basic.spec.ts']
    }
}

const specs = defineSpecs(target)
let screenshotCount = 0

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
        afterTest: async function (_test:unknown, _context:unknown, result: Frameworks.TestResult) {
            if (!result.passed) {
                await browser.saveScreenshot(path.join(outputDir, `screenshot-${screenshotCount++}.png`))
            }
        },
    }
}

const workspace = target === 'workspace' ? '../samples/e2e/wdio.code-workspace' : `../samples/e2e/${target}`

export const config: WebdriverIO.Config = {
    ...createBaseConfig(workspace),
    specs,
}
