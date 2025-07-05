import * as path from 'node:path'
import * as url from 'node:url'

import * as core from '@actions/core'
import { minVersion } from 'semver'
import shell from 'shelljs'

import pkg from '../packages/vscode-webdriverio/package.json' with { type: 'json' }
import type { Frameworks } from '@wdio/types'

type TestTargets = 'workspace' | 'mocha' | 'jasmine' | 'cucumber'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const prjRoot = path.resolve(__dirname, '..')
const target = (process.env.VSCODE_WDIO_E2E_SCENARIO || 'mocha') as TestTargets

const minimumVersion = minVersion(pkg.engines.vscode)?.version || 'stable'

const isCompatibilityMode = process.env.VSCODE_WDIO_E2E_COMPATIBILITY_MODE === 'yes'
const version = isCompatibilityMode ? minimumVersion : 'stable'

const outputDir = path.join(__dirname, 'logs', [isCompatibilityMode ? 'compatibility' : 'e2e', target].join('-'))
process.env.VSCODE_WDIO_TRACE_LOG_PATH = outputDir

const loglevel = process.env.VSCODE_WDIO_SMOKE_RETRO_WIN ? 'debug' : 'trace'

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

class ScreenshotNameGenerator {
    private readonly _counterMap = new Map<string, number>

    private _generateMapId(file:string, title:string) {
        return `${file}-${title}`
    }

    getFilename(file:string, title:string) {
        const mapId = this._generateMapId(file, title)
        const counter = this._counterMap.get(mapId)
        const newCounter = typeof counter === 'undefined' ? 0 : counter + 1
        this._counterMap.set(mapId, newCounter)
        const _title =  title
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('')
        return `screenshot-${path.basename(file)}-${_title}-${newCounter}.png`
    }
}

const ssNameGenerator = new ScreenshotNameGenerator()

export function createBaseConfig(workspacePath: string, userSettings = {}): WebdriverIO.Config {
    const resolvedUserSettings = Object.assign(
        {},
        {
            'webdriverio.logLevel': loglevel,
        },
        userSettings
    )

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
                    userSettings: resolvedUserSettings,
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
        before: async function (_capabilities, _specs, _browser) {
            // For Github Actions on Linux, Maximize the screen by GUI approach
            // See also .github/actions/set-screen-resolution/action.yml
            if (process.env.GITHUB_ACTIONS === 'true' && process.platform === 'linux') {
                const result = shell.exec('xdotool search --onlyvisible --name code', { silent: true })
                const windowId = result.stdout.trim()
                shell.exec(`xdotool windowmove ${windowId} 0 0`, { silent: true })
                shell.exec(`xdotool windowsize ${windowId} 100% 100%`, { silent: true })
            }
        },
        afterTest: async function (test: Frameworks.Test, _context: unknown, result: Frameworks.TestResult) {
            if (!result.passed) {
                await browser.saveScreenshot(path.join(outputDir, ssNameGenerator.getFilename(test.file, test.title)))
            }
            if (process.env.GITHUB_ACTIONS === 'true' && result.retries.attempts === 1) {
                core.warning(`Retried: ${test.title}`, {
                    title: 'Test was retried.',
                    file: path.relative(prjRoot, test.file),
                })
            }
        },
    }
}

const workspace = target === 'workspace' ? '../samples/e2e/wdio.code-workspace' : `../samples/e2e/${target}`

export const config: WebdriverIO.Config = {
    ...createBaseConfig(workspace),
    specs,
}
