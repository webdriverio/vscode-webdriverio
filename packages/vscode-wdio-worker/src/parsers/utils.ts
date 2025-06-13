import path from 'node:path'

import type { WorkerMetaContext } from '@vscode-wdio/types/worker'
import type { parseCucumberFeature } from './cucumber.js'

export type CucumberParser = typeof parseCucumberFeature

const CUCUMBER_PARSER_PATH = path.resolve(__dirname, 'parser/cucumber.cjs')

let cucumberParser: CucumberParser | undefined

export async function getCucumberParser(context: WorkerMetaContext): Promise<CucumberParser> {
    if (cucumberParser) {
        context.log.debug('Use cached Cucumber parser')
        return cucumberParser
    }
    context.log.debug('Import Cucumber parser')
    cucumberParser = (await import(CUCUMBER_PARSER_PATH)).parseCucumberFeature as CucumberParser
    return cucumberParser
}
