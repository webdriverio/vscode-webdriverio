import * as fs from 'node:fs/promises'

import path from 'node:path'
import { parseCucumberFeature } from './cucumber.js'
import { parseTestCases } from './js.js'

import type { ReadSpecsOptions } from '../../api/index.js'
import type { WorkerMetaContext } from '../types.js'

export async function parse(this: WorkerMetaContext, options: ReadSpecsOptions) {
    return await Promise.all(
        options.specs.map(async (spec) => {
            const normalizeSpecPath = path.normalize(spec)
            this.log.debug(`Parse spec file: ${normalizeSpecPath}`)
            const contents = await fs.readFile(normalizeSpecPath, { encoding: 'utf8' })

            const testCases = isCucumberFeatureFile(normalizeSpecPath)
                ? parseCucumberFeature.call(this, contents, normalizeSpecPath) // Parse Cucumber feature file
                : parseTestCases.call(this, contents, normalizeSpecPath) // Parse JavaScript/TypeScript test file

            this.log.debug(`Successfully parsed: ${normalizeSpecPath}`)
            return {
                spec: normalizeSpecPath,
                tests: testCases,
            }
        })
    )
}

/**
 * Check if a file is a Cucumber feature file
 * @param filePath File path to check
 * @returns True if it's a feature file
 */
function isCucumberFeatureFile(filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.feature'
}
