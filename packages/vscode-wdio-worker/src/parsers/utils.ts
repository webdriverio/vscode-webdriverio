import path from 'node:path'

import { dynamicLoader } from '../utils.js'
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
    return (await dynamicLoader(
        context,
        cucumberParser,
        CUCUMBER_PARSER_PATH,
        'parseCucumberFeature'
    )) as CucumberParser
}

export async function getAstParser(context: WorkerMetaContext): Promise<AstParser> {
    return (await dynamicLoader(context, astParser, AST_PARSER_PATH, 'parseTestCases')) as AstParser
}
