import * as fs from 'node:fs/promises'
import path from 'node:path'

import { parseTestCases } from './js.js'
import { getCucumberParser } from './utils.js'
import type { ReadSpecsOptions } from '@vscode-wdio/types/api'
import type { WorkerMetaContext } from '@vscode-wdio/types/worker'

async function parseFeatureFile(context: WorkerMetaContext, contents: string, normalizeSpecPath: string) {
    const p = await getCucumberParser(context)
    return p.call(context, contents, normalizeSpecPath)
}

export async function parse(this: WorkerMetaContext, options: ReadSpecsOptions) {
    return await Promise.all(
        options.specs.map(async (spec) => {
            const normalizeSpecPath = path.normalize(spec)
            this.log.debug(`Parse spec file: ${normalizeSpecPath}`)
            const contents = await fs.readFile(normalizeSpecPath, { encoding: 'utf8' })
            try {
                const testCases = isCucumberFeatureFile(normalizeSpecPath)
                    ? await parseFeatureFile(this, contents, normalizeSpecPath) // Parse Cucumber feature file
                    : parseTestCases.call(this, contents, normalizeSpecPath) // Parse JavaScript/TypeScript test file

                this.log.debug(`Successfully parsed: ${normalizeSpecPath}`)
                return {
                    spec: normalizeSpecPath,
                    tests: testCases,
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error)
                this.log.error(`Parse error: ${errorMessage}`)
                return {
                    spec: normalizeSpecPath,
                    tests: [],
                }
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
