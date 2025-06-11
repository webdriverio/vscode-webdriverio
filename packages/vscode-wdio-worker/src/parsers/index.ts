import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { parseWithWdio } from './parser.js'
import { getCucumberParser } from './utils.js'
import type { ReadSpecsOptions } from '@vscode-wdio/types/api'
import type { WorkerMetaContext } from '@vscode-wdio/types/worker'
import type { parseCucumberFeature } from './cucumber.js'

let cucumberParser: typeof parseCucumberFeature | undefined

async function parseFeatureFile(context: WorkerMetaContext, contents: string, normalizeSpecPath: string) {
    const p = await getCucumberParser(cucumberParser)
    return p.call(context, contents, normalizeSpecPath)
}

export async function parse(this: WorkerMetaContext, options: ReadSpecsOptions) {
    if (options.specs.length === 0) {
        return []
    }
    const testMap = options.framework !== 'cucumber' ? await parseWithWdio(this, options) : undefined

    const getTestData = function (spec: string) {
        const data = testMap?.get(spec)
        if (!data) {
            throw new Error(`TestData is not found: ${spec}`)
        }
        return data
    }

    return await Promise.all(
        options.specs.map(async (spec) => {
            const normalizeSpecPath = path.normalize(spec)
            this.log.debug(`Parse spec file: ${normalizeSpecPath}`)
            const contents = await fs.readFile(normalizeSpecPath, { encoding: 'utf8' })
            try {
                const testCases = isCucumberFeatureFile(normalizeSpecPath)
                    ? await parseFeatureFile(this, contents, normalizeSpecPath) // Parse Cucumber feature file
                    : getTestData(normalizeSpecPath.replace(/^([a-z]):/, (_match, p1) => `${p1.toUpperCase()}:`))

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
