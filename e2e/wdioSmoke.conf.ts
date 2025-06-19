import { createBaseConfig } from './wdio.conf.ts'

type TestTargets = 'config' | 'timeout' | 'env'

const target = (process.env.VSCODE_WDIO_E2E_SCENARIO || 'config') as TestTargets

function defineSmokePrams(target: TestTargets) {
    switch (target) {
        case 'config':
            return {
                specs: [
                    './tests/updateConfig.spec.ts',
                    './tests/updateSpec.spec.ts',
                    './tests/updateErrorSpec.spec.ts',
                    './tests/updateErrorConfig.spec.ts',
                ],
                workspace: '../samples/smoke/update-config',
                settings: {},
            }
        case 'timeout':
            return {
                specs: ['./tests/workerIdleTimeout.spec.ts'],
                workspace: '../samples/e2e/cucumber',
                settings: { 'webdriverio.logLevel': 'debug', 'webdriverio.workerIdleTimeout': 2 },
            }
        case 'env':
            return {
                specs: [
                    './tests/envEnable.spec.ts',
                    './tests/envDisable.spec.ts'
                ],
                workspace: '../samples/smoke/env',
                settings: { 'webdriverio.envFiles': ['.env'] },
            }
        default:
            throw new Error(`Not defined scenario: ${target}`)
    }
}

const params = defineSmokePrams(target)
export const config: WebdriverIO.Config = {
    ...createBaseConfig(params.workspace, params.settings),
    specs: params.specs,
    maxInstances: 1,
}
