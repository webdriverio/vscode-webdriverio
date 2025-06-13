import * as fs from 'node:fs/promises'

import { Parser, AstBuilder, GherkinClassicTokenMatcher } from '@cucumber/gherkin'
import { IdGenerator, type Scenario, type Step, type GherkinDocument } from '@cucumber/messages'
import type { CucumberTestData, StepType, WorkerMetaContext } from '@vscode-wdio/types/worker'

/**
 * Parse Cucumber feature files and extract scenarios and steps
 *
 * @param fileContent Content of the feature file
 * @param uri File URI for error reporting
 * @returns Array of test case information
 */
export function parseCucumberFeature(this: WorkerMetaContext, fileContent: string, uri: string) {
    this.log.debug(`Start parsing the cucumber feature file: ${uri}`)
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
 * This implementation focuses on scenarios and higher-level elements only
 *
 * @param document Gherkin document
 * @returns Array of CucumberTestData representing test structure
 */
function processGherkinDocument(document: GherkinDocument): CucumberTestData[] {
    const features: CucumberTestData[] = []

    if (!document.feature) {
        return features
    }

    // Process feature - end position will be calculated after processing all children
    const feature = document.feature
    const featureData: CucumberTestData = {
        type: 'feature',
        name: feature.name || '(Unnamed Feature)',
        // Initial range with placeholder end position (will be updated later)
        range: {
            start: locationToPosition(feature.location),
            end: locationToPosition(feature.location), // Temporary, will be updated
        },
        children: [],
        metadata: {
            description: feature.description || undefined,
            tags: feature.tags?.map((tag: any) => ({
                name: tag.name,
                range: {
                    start: locationToPosition(tag.location),
                    end: locationToPosition(tag.location, tag.name?.length || 0),
                },
            })),
        },
    }

    // Last position tracker for updating end positions
    let lastEndPosition: { line: number; column: number } = featureData.range.start

    // Process children (Scenarios, Background, Rules, etc.)
    if (feature.children) {
        for (const child of feature.children) {
            if (child.background) {
                // Backgrounds are at the same level as scenarios in the tree
                const background = child.background
                const backgroundPosition = locationToPosition(background.location)
                let lastStepPosition = backgroundPosition

                // Find the end position of the last step
                if (background.steps && background.steps.length > 0) {
                    const lastStep = background.steps[background.steps.length - 1]
                    lastStepPosition = calculateLastStepPosition(lastStep)
                }

                const backgroundData: CucumberTestData = {
                    type: 'background',
                    name: background.name || 'Background',
                    range: {
                        start: backgroundPosition,
                        end: lastStepPosition,
                    },
                    children: [], // No children as we don't include steps
                    metadata: {
                        description: background.description || undefined,
                    },
                }

                featureData.children.push(backgroundData)
                lastEndPosition = lastStepPosition
            } else if (child.scenario) {
                // Process regular scenario
                const scenarioData = processScenario(child.scenario)
                featureData.children.push(scenarioData)

                // Update the last end position if this scenario ends later
                if (comparePositions(scenarioData.range.end, lastEndPosition) > 0) {
                    lastEndPosition = scenarioData.range.end
                }
            } else if (child.rule) {
                // Process rule (added for Rule support)
                const rule = child.rule
                const ruleData: CucumberTestData = {
                    type: 'rule',
                    name: rule.name || '(Unnamed Rule)',
                    range: {
                        start: locationToPosition(rule.location),
                        end: locationToPosition(rule.location), // Temporary, will be updated
                    },
                    children: [],
                    metadata: {
                        description: rule.description || undefined,
                        tags: rule.tags?.map((tag: any) => ({
                            name: tag.name,
                            range: {
                                start: locationToPosition(tag.location),
                                end: locationToPosition(tag.location, tag.name?.length || 0),
                            },
                        })),
                    },
                }

                // Track the last position within this rule
                let ruleLastPosition = ruleData.range.start

                // Process children of rule (usually scenarios)
                if (rule.children) {
                    for (const ruleChild of rule.children) {
                        if (ruleChild.background) {
                            // Rules can have their own background
                            const background = ruleChild.background
                            const backgroundPosition = locationToPosition(background.location)
                            let lastStepPosition = backgroundPosition

                            // Find the end position of the last step
                            if (background.steps && background.steps.length > 0) {
                                const lastStep = background.steps[background.steps.length - 1]
                                lastStepPosition = calculateLastStepPosition(lastStep)
                            }

                            const backgroundData: CucumberTestData = {
                                type: 'background',
                                name: background.name || 'Background',
                                range: {
                                    start: backgroundPosition,
                                    end: lastStepPosition,
                                },
                                children: [], // No children as we don't include steps
                                metadata: {
                                    description: background.description || undefined,
                                },
                            }

                            ruleData.children.push(backgroundData)

                            // Update rule's last position if needed
                            if (comparePositions(lastStepPosition, ruleLastPosition) > 0) {
                                ruleLastPosition = lastStepPosition
                            }
                        } else if (ruleChild.scenario) {
                            // Process scenario inside rule
                            const scenarioData = processScenario(ruleChild.scenario)
                            ruleData.children.push(scenarioData)

                            // Update rule's last position if needed
                            if (comparePositions(scenarioData.range.end, ruleLastPosition) > 0) {
                                ruleLastPosition = scenarioData.range.end
                            }
                        }
                    }
                }

                // Update the rule's end position to be the last position of its children
                ruleData.range.end = ruleLastPosition

                featureData.children.push(ruleData)

                // Update feature's last position if needed
                if (comparePositions(ruleLastPosition, lastEndPosition) > 0) {
                    lastEndPosition = ruleLastPosition
                }
            }
        }
    }

    // Update the feature's end position to be the last position of its children
    featureData.range.end = lastEndPosition

    features.push(featureData)
    return features
}

/**
 * Process a scenario from Gherkin AST into CucumberTestData
 * Steps are not included as separate TestData objects
 *
 * @param scenario Gherkin scenario
 * @returns Processed scenario as CucumberTestData
 */
function processScenario(scenario: Scenario): CucumberTestData {
    const scenarioPosition = locationToPosition(scenario.location)

    // Calculate the end position based on the last step or example
    let lastPosition = scenarioPosition

    // Process steps to find the last position
    if (scenario.steps && scenario.steps.length > 0) {
        const lastStep = scenario.steps[scenario.steps.length - 1]
        lastPosition = calculateLastStepPosition(lastStep)
    }

    // Create scenario data
    const scenarioData: CucumberTestData = {
        type: scenario.examples && scenario.examples.length > 0 ? 'scenarioOutline' : 'scenario',
        name: scenario.name || '(Unnamed Scenario)',
        range: {
            start: scenarioPosition,
            end: lastPosition, // This might be updated if examples exist
        },
        children: [], // No children for steps
        metadata: {
            description: scenario.description || undefined,
            tags: scenario.tags?.map((tag: any) => ({
                name: tag.name,
                range: {
                    start: locationToPosition(tag.location),
                    end: locationToPosition(tag.location, tag.name?.length || 0),
                },
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
    if (scenario.examples && scenario.examples.length > 0) {
        for (const example of scenario.examples) {
            const examplePosition = locationToPosition(example.location)
            let exampleEndPosition = examplePosition

            // Calculate end position for example including its table
            if (example.tableBody && example.tableBody.length > 0) {
                const lastRow = example.tableBody[example.tableBody.length - 1]
                if (lastRow.location) {
                    // Estimate the end position of the last row
                    const rowPosition = locationToPosition(lastRow.location)

                    // If cells exist, estimate length based on the last cell
                    if (lastRow.cells && lastRow.cells.length > 0) {
                        const lastCell = lastRow.cells[lastRow.cells.length - 1]
                        const cellLength = lastCell.value?.length || 0
                        exampleEndPosition = {
                            line: rowPosition.line,
                            column: rowPosition.column + cellLength + 2, // +2 for cell delimiter
                        }
                    } else {
                        exampleEndPosition = rowPosition
                    }
                }
            }

            const exampleData: CucumberTestData = {
                type: 'examples',
                name: example.name || 'Examples',
                range: {
                    start: examplePosition,
                    end: exampleEndPosition,
                },
                children: [],
                metadata: {
                    description: example.description || undefined,
                    tags: example.tags?.map((tag: any) => ({
                        name: tag.name,
                        range: {
                            start: locationToPosition(tag.location),
                            end: locationToPosition(tag.location, tag.name?.length || 0),
                        },
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

            // Update scenario's end position if this example ends later
            if (comparePositions(exampleEndPosition, scenarioData.range.end) > 0) {
                scenarioData.range.end = exampleEndPosition
            }
        }
    }

    return scenarioData
}

/**
 * Calculate the end position of a step including its data table or doc string
 *
 * @param step The step to analyze
 * @returns The end position of the step
 */
function calculateLastStepPosition(step: any): { line: number; column: number } {
    const stepPosition = locationToPosition(step.location)
    const textLength = step.text?.length || 0
    let endPosition = {
        line: stepPosition.line,
        column: stepPosition.column + (step.keyword?.length || 0) + textLength,
    }

    // If there's a data table, find its end
    if (step.dataTable && step.dataTable.rows) {
        const rows = step.dataTable.rows
        if (rows.length > 0) {
            const lastRow = rows[rows.length - 1]
            if (lastRow.location) {
                const rowPosition = locationToPosition(lastRow.location)
                let rowLength = 0

                // Calculate the length of the row based on its cells
                if (lastRow.cells && lastRow.cells.length > 0) {
                    lastRow.cells.forEach((cell: any) => {
                        rowLength += (cell.value?.length || 0) + 3 // +3 for cell delimiters and padding
                    })
                }

                const tableEndPosition = {
                    line: rowPosition.line,
                    column: rowPosition.column + rowLength,
                }

                // Update end position if the table ends later
                if (comparePositions(tableEndPosition, endPosition) > 0) {
                    endPosition = tableEndPosition
                }
            }
        }
    }

    // If there's a doc string, find its end
    if (step.docString) {
        // If the docString has its own location info
        if (step.docString.location) {
            const docStringPosition = locationToPosition(step.docString.location)
            const contentLines = (step.docString.content || '').split('\n')
            const lastLineLength = contentLines.length > 0 ? contentLines[contentLines.length - 1].length : 0

            // Estimate the end position of the doc string
            const docStringEnd = {
                line: docStringPosition.line + contentLines.length + 1, // +1 for closing quotes
                column: lastLineLength > 0 ? lastLineLength : 3, // At least 3 for closing quotes
            }

            // Update end position if the doc string ends later
            if (comparePositions(docStringEnd, endPosition) > 0) {
                endPosition = docStringEnd
            }
        }
    }

    return endPosition
}
/**
 * Process a step from Gherkin AST into CucumberTestData
 *
 * @param step Gherkin step
 * @returns Processed step as CucumberTestData
 */
function processStep(step: Step): CucumberTestData {
    const stepType = step.keyword.trim()
    const stepText = `${stepType} ${step.text}`

    const stepData: CucumberTestData = {
        type: 'step',
        name: stepText,
        range: {
            start: locationToPosition(step.location),
            end: locationToPosition(step.location, stepText.length),
        },
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
 * Convert Gherkin location to a position with line and column information
 *
 * @param location Gherkin location
 * @param additionalLength Optional length to add to the column (for tags, etc.)
 * @returns Position with line and column
 */
function locationToPosition(location?: any, additionalLength: number = 0): { line: number; column: number } {
    // Default position if location is missing
    if (!location) {
        return { line: 0, column: 0 }
    }

    // In Gherkin AST, the location contains line and column (1-based)
    // Convert to 0-based for VSCode compatibility
    const line = Math.max(0, (location.line || 1) - 1)
    const column = Math.max(0, (location.column || 1) - 1) + additionalLength

    return { line, column }
}

/**
 * Compare two positions to determine their order
 *
 * @param a First position
 * @param b Second position
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
function comparePositions(a: { line: number; column: number }, b: { line: number; column: number }): number {
    if (a.line < b.line) {
        return -1
    }
    if (a.line > b.line) {
        return 1
    }
    if (a.column < b.column) {
        return -1
    }
    if (a.column > b.column) {
        return 1
    }
    return 0
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
