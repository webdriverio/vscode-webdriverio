import path from 'node:path'

import type { WorkerMetaContext } from '@vscode-wdio/types/worker'
import type { parseCucumberFeature } from './cucumber.js'
import type { parseTestCases } from './js.js'

export type CucumberParser = typeof parseCucumberFeature
export type AstParser = typeof parseTestCases

const CUCUMBER_PARSER_PATH = path.resolve(__dirname, 'parser/cucumber.cjs')
const AST_PARSER_PATH = path.resolve(__dirname, 'parser/ast.cjs')

let cucumberParser: CucumberParser | undefined
let astParser: AstParser | undefined

export async function getCucumberParser(context: WorkerMetaContext): Promise<CucumberParser> {
    if (cucumberParser) {
        context.log.debug('Use cached Cucumber parser')
        return cucumberParser
    }
    context.log.debug('Import Cucumber parser')
    cucumberParser = (await import(CUCUMBER_PARSER_PATH)).parseCucumberFeature as CucumberParser
    return cucumberParser
}

export async function getAstParser(context: WorkerMetaContext): Promise<AstParser> {
    if (astParser) {
        context.log.debug('Use cached Ast parser')
        return astParser
    }
    context.log.debug('Import Ast parser')
    astParser = (await import(AST_PARSER_PATH)).parseTestCases as AstParser
    return astParser
}
