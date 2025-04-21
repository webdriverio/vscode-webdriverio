import * as fs from 'node:fs/promises'
import { Parser, AstBuilder, GherkinClassicTokenMatcher } from '@cucumber/gherkin'
import { IdGenerator, type GherkinDocument } from '@cucumber/messages'

import type { CucumberTestData, StepType, SourceRange, WorkerMetaContext } from '../types.js'
/**
 * Parse Cucumber feature files and extract scenarios and steps
 *
 * @param fileContent Content of the feature file
 * @param uri File URI for error reporting
 * @returns Array of test case information
 */
export function parseCucumberFeature(this: WorkerMetaContext, fileContent: string, uri: string) {
    this.log.debug('Cucumber parser is used.')
    try {
        // Initialize the parser components
        const builder = new AstBuilder(IdGenerator.uuid())
        const matcher = new GherkinClassicTokenMatcher()
        const parser = new Parser(builder, matcher)

        // Parse the content
        const gherkinDocument = parser.parse(fileContent)

        // Process the document to extract test structure
        return processGherkinDocument(gherkinDocument)
    } catch (error) {
        const errorMessage = `Failed to parse feature file ${uri}: ${error instanceof Error ? error.message : String(error)}`
        this.log.error(errorMessage)
        throw new Error(errorMessage)
    }
}

/**
 * Process Gherkin document to build test structure
 *
 * @param document Gherkin document
 * @returns Array of CucumberTestData representing test structure
 */
function processGherkinDocument(document: GherkinDocument): CucumberTestData[] {
    const features: CucumberTestData[] = []

    if (!document.feature) {
        return features
    }

    // Process feature
    const feature = document.feature
    const featureData: CucumberTestData = {
        type: 'feature',
        name: feature.name || '(Unnamed Feature)',
        range: locationToRange(feature.location),
        children: [],
        metadata: {
            description: feature.description || undefined,
            tags: feature.tags?.map((tag: any) => ({
                name: tag.name,
                range: locationToRange(tag.location),
            })),
        },
    }

    // Process children (Scenarios, Background, Rules, etc.)
    if (feature.children) {
        for (const child of feature.children) {
            if (child.background) {
                const background = child.background
                const backgroundData: CucumberTestData = {
                    type: 'background',
                    name: background.name || 'Background',
                    range: locationToRange(background.location),
                    children: [],
                    metadata: {
                        description: background.description || undefined,
                    },
                }

                // Process background steps
                if (background.steps) {
                    for (const step of background.steps) {
                        backgroundData.children.push(processStep(step))
                    }
                }

                featureData.children.push(backgroundData)
            } else if (child.scenario) {
                // Process regular scenario
                const scenarioData = processScenario(child.scenario)
                featureData.children.push(scenarioData)
            } else if (child.rule) {
                // Process rule (added for Rule support)
                const rule = child.rule
                const ruleData: CucumberTestData = {
                    type: 'rule',
                    name: rule.name || '(Unnamed Rule)',
                    range: locationToRange(rule.location),
                    children: [],
                    metadata: {
                        description: rule.description || undefined,
                        tags: rule.tags?.map((tag: any) => ({
                            name: tag.name,
                            range: locationToRange(tag.location),
                        })),
                    },
                }

                // Process children of rule (usually scenarios)
                if (rule.children) {
                    for (const ruleChild of rule.children) {
                        if (ruleChild.background) {
                            // Rules can have their own background
                            const background = ruleChild.background
                            const backgroundData: CucumberTestData = {
                                type: 'background',
                                name: background.name || 'Background',
                                range: locationToRange(background.location),
                                children: [],
                                metadata: {
                                    description: background.description || undefined,
                                },
                            }

                            // Process background steps
                            if (background.steps) {
                                for (const step of background.steps) {
                                    backgroundData.children.push(processStep(step))
                                }
                            }

                            ruleData.children.push(backgroundData)
                        } else if (ruleChild.scenario) {
                            // Process scenario inside rule
                            const scenarioData = processScenario(ruleChild.scenario)
                            ruleData.children.push(scenarioData)
                        }
                    }
                }

                featureData.children.push(ruleData)
            }
        }
    }

    features.push(featureData)
    return features
}

/**
 * Process a scenario from Gherkin AST into CucumberTestData
 *
 * @param scenario Gherkin scenario
 * @returns Processed scenario as CucumberTestData
 */
function processScenario(scenario: any): CucumberTestData {
    const scenarioData: CucumberTestData = {
        type: scenario.examples && scenario.examples.length > 0 ? 'scenarioOutline' : 'scenario',
        name: scenario.name || '(Unnamed Scenario)',
        range: locationToRange(scenario.location),
        children: [],
        metadata: {
            description: scenario.description || undefined,
            tags: scenario.tags?.map((tag: any) => ({
                name: tag.name,
                range: locationToRange(tag.location),
            })),
        },
    }

    // Process steps
    if (scenario.steps) {
        for (const step of scenario.steps) {
            scenarioData.children.push(processStep(step))
        }
    }

    // Process examples for Scenario Outline
    if (scenario.examples) {
        for (const example of scenario.examples) {
            const exampleData: CucumberTestData = {
                type: 'examples',
                name: example.name || 'Examples',
                range: locationToRange(example.location),
                children: [],
                metadata: {
                    description: example.description || undefined,
                    tags: example.tags?.map((tag: any) => ({
                        name: tag.name,
                        range: locationToRange(tag.location),
                    })),
                },
            }

            // Store example data for future use (execution, etc.)
            if (example.tableHeader && example.tableBody) {
                const headerCells = example.tableHeader.cells || []
                const headers = headerCells.map((cell: any) => cell.value || '')

                const examples: { [key: string]: string[] } = {}
                headers.forEach((header: string) => {
                    examples[header] = []
                })

                example.tableBody.forEach((row: any) => {
                    if (row.cells) {
                        row.cells.forEach((cell: any, index: number) => {
                            if (index < headers.length) {
                                examples[headers[index]].push(cell.value || '')
                            }
                        })
                    }
                })

                exampleData.metadata.examples = examples
            }

            scenarioData.children.push(exampleData)
        }
    }

    return scenarioData
}

/**
 * Process a step from Gherkin AST into CucumberTestData
 *
 * @param step Gherkin step
 * @returns Processed step as CucumberTestData
 */
function processStep(step: any): CucumberTestData {
    const stepData: CucumberTestData = {
        type: 'step',
        name: step.text || '',
        range: locationToRange(step.location),
        children: [],
        metadata: {
            stepType: step.keyword?.trim() as StepType,
        },
    }

    // Process data table if present
    if (step.dataTable) {
        const rows: string[][] = []

        step.dataTable.rows?.forEach((row: any) => {
            const cells: string[] = []
            row.cells?.forEach((cell: any) => {
                cells.push(cell.value || '')
            })
            rows.push(cells)
        })

        stepData.metadata.dataTable = rows
    }

    // Process doc string if present
    if (step.docString) {
        stepData.metadata.docString = step.docString.content || ''
    }

    return stepData
}

/**
 * Convert Gherkin location to SourceRange
 *
 * @param location Gherkin location
 * @returns SourceRange for VSCode
 */
function locationToRange(location?: any): SourceRange {
    // Default position if location is missing
    if (!location) {
        return {
            start: { offset: 0 },
            end: { offset: 0 },
        }
    }

    // For simplicity, we'll use just line numbers as offsets
    // In a real implementation, you would compute proper offsets based on line and column
    return {
        start: { offset: location.line || 0 },
        end: { offset: (location.line || 0) + 1 }, // Approximate one line span
    }
}

/**
 * Helper function to read file content from a file path
 *
 * @param filePath Path of the file to read
 * @returns Content of the file
 */
export async function readFeatureFile(filePath: string): Promise<string> {
    try {
        return await fs.readFile(filePath, { encoding: 'utf8' })
    } catch (error) {
        throw new Error(`File reading error: ${(error as Error).message}`)
    }
}
