import path from 'node:path'
import type { parseCucumberFeature } from './cucumber.js'

export type CucumberParser = typeof parseCucumberFeature

const CUCUMBER_PARSER_PATH = path.resolve(__dirname, 'cucumber.cjs')

export async function getCucumberParser(cucumberParser: CucumberParser | undefined): Promise<CucumberParser> {
    return !cucumberParser
        ? ((await import(CUCUMBER_PARSER_PATH)).parseCucumberFeature as CucumberParser)
        : cucumberParser!
}
