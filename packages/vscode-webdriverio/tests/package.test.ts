import { DEFAULT_CONFIG_VALUES, EXTENSION_ID } from '@vscode-wdio/constants'
import { describe, it, expect } from 'vitest'

import pkg from '../package.json' with { type: 'json' }

describe('package.json', ()=>{

    const testPattern = []
    for (const [key, value] of Object.entries(DEFAULT_CONFIG_VALUES)) {
        testPattern.push([key, value])
    }

    const pkgConfig = pkg.contributes.configuration.properties

    it.each(testPattern)('should set default value - %s', (key, value)=>{
        // @ts-ignore
        const pkgConfigValue = pkgConfig[`${EXTENSION_ID}.${key}`]['default']
        expect(pkgConfigValue).toStrictEqual(value)
    })
})
