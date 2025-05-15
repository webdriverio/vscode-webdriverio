import * as fs from 'node:fs/promises'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { parseCucumberFeature, readFeatureFile } from '../../src/parsers/cucumber.js'
import type { CucumberTestData, WorkerMetaContext } from '@vscode-wdio/types/worker'

// Mock fs module
vi.mock('node:fs/promises', () => ({
    readFile: vi.fn(),
}))

describe('Cucumber Parser', () => {
    // Create mock WorkerMetaContext for the parseCucumberFeature function
    const mockContext: WorkerMetaContext = {
        log: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
    } as unknown as WorkerMetaContext

    // Sample Cucumber feature file contents with different patterns
    const basicFeatureContent = `Feature: Basic Feature
    As a user
    I want to test basic Cucumber functionality

    Scenario: Basic scenario
      Given I am on the homepage
      When I enter "search text"
      Then I should see search results

    Scenario: Another scenario
      Given I am logged in
      When I visit my profile
      Then I should see my account details
  `

    const featureWithBackground = `Feature: Feature with Background
    Background:
      Given I am logged in
      And the system is ready

    Scenario: First scenario with background
      When I click the settings button
      Then I should see the settings page

    Scenario: Second scenario with background
      When I click the profile button
      Then I should see my profile
  `

    const scenarioOutlineContent = `Feature: Scenario Outline Example

    Scenario Outline: Testing multiple values
      Given I enter "<input>" in the search box
      When I click search
      Then I should see "<expected>" in the results

      Examples:
        | input    | expected |
        | apple    | fruit    |
        | cucumber | vegetable|
        | salmon   | fish     |
  `

    const featureWithTags = `@feature-tag
    Feature: Tagged Feature

    @scenario-tag
    Scenario: Tagged scenario
      Given I have a tagged scenario
      When I run it
      Then it should be properly identified

    @outline-tag
    Scenario Outline: Tagged outline
      Given I test with "<value>"
      Then I should see "<result>"

      @examples-tag
      Examples:
        | value | result |
        | test1 | pass1  |
        | test2 | pass2  |
  `

    const featureWithRules = `Feature: Rules Example

    Rule: First business rule
      Background:
        Given the rule precondition

      Scenario: Rule scenario 1
        When I follow the rule
        Then I should see compliance

      Scenario: Rule scenario 2
        When I break the rule
        Then I should see a warning

    Rule: Second business rule
      Scenario: Another rule test
        Given I start with the second rule
        When I apply it
        Then I should see correct results
  `

    const featureWithDataTableAndDocString = `Feature: Complex Data Feature

    Scenario: Scenario with data table
      Given I have the following users:
        | name    | email           | role  |
        | John    | john@test.com   | admin |
        | Jane    | jane@test.com   | user  |
      When I filter by "admin" role
      Then I should see 1 user

    Scenario: Scenario with doc string
      Given I have the following JSON payload:
        """
        {
          "user": {
            "name": "Test User",
            "permissions": ["read", "write"]
          }
        }
        """
      When I send it to the API
      Then I should receive a success response
  `

    const invalidFeatureContent = `Invalid Feature
    This has invalid Gherkin syntax

    Scenario Invalid format
      Given missing colon
      When step
      Then incomplete
  `

    beforeEach(() => {
        vi.resetAllMocks()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('parseCucumberFeature', () => {
        it('should parse basic feature file correctly', () => {
            // Execute
            const features = parseCucumberFeature.call(mockContext, basicFeatureContent, 'basic-feature.feature')

            // Verify
            expect(features.length).toBe(1)

            // Check feature
            const feature = features[0]
            expect(feature.type).toBe('feature')
            expect(feature.name).toBe('Basic Feature')
            expect(feature.children.length).toBe(2)

            // Check first scenario
            const firstScenario = feature.children[0]
            expect(firstScenario.type).toBe('scenario')
            expect(firstScenario.name).toBe('Basic scenario')
            expect(firstScenario.children.length).toBe(3)

            // Check steps of first scenario
            const steps = firstScenario.children
            expect(steps[0].type).toBe('step')
            expect(steps[0].name).toBe('Given I am on the homepage')
            expect(steps[0].metadata.stepType).toBe('Given')

            expect(steps[1].type).toBe('step')
            expect(steps[1].name).toBe('When I enter "search text"')
            expect(steps[1].metadata.stepType).toBe('When')

            expect(steps[2].type).toBe('step')
            expect(steps[2].name).toBe('Then I should see search results')
            expect(steps[2].metadata.stepType).toBe('Then')
        })

        it('should parse feature with background correctly', () => {
            // Execute
            const features = parseCucumberFeature.call(mockContext, featureWithBackground, 'background-feature.feature')

            // Verify
            expect(features.length).toBe(1)

            // Check feature
            const feature = features[0]
            expect(feature.type).toBe('feature')
            expect(feature.name).toBe('Feature with Background')
            expect(feature.children.length).toBe(3) // Background + 2 scenarios

            // Check background
            const background = feature.children[0]
            expect(background.type).toBe('background')
            expect(background.name).toBe('Background')

            // Check scenarios
            const firstScenario = feature.children[1]
            expect(firstScenario.type).toBe('scenario')
            expect(firstScenario.name).toBe('First scenario with background')

            const secondScenario = feature.children[2]
            expect(secondScenario.type).toBe('scenario')
            expect(secondScenario.name).toBe('Second scenario with background')
        })

        it('should parse scenario outline with examples correctly', () => {
            // Execute
            const features = parseCucumberFeature.call(mockContext, scenarioOutlineContent, 'outline-feature.feature')

            // Verify
            expect(features.length).toBe(1)

            // Check feature
            const feature = features[0]
            expect(feature.type).toBe('feature')

            // Check scenario outline
            const outline = feature.children[0]
            expect(outline.type).toBe('scenarioOutline')
            expect(outline.name).toBe('Testing multiple values')
            expect(outline.children.length).toBe(4) // 3 steps + examples

            // Check examples
            const examples = outline.children[3]
            expect(examples.type).toBe('examples')
            expect(examples.name).toBe('Examples')

            // Check examples data
            expect(examples.metadata.examples).toBeDefined()
            const examplesData = examples.metadata.examples as { [key: string]: string[] }
            expect(examplesData.input).toEqual(['apple', 'cucumber', 'salmon'])
            expect(examplesData.expected).toEqual(['fruit', 'vegetable', 'fish'])
        })

        it('should parse feature with tags correctly', () => {
            // Execute
            const features = parseCucumberFeature.call(mockContext, featureWithTags, 'tagged-feature.feature')

            // Verify
            expect(features.length).toBe(1)

            // Check feature tags
            const feature = features[0]
            expect(feature.metadata.tags).toBeDefined()
            expect(feature.metadata.tags?.length).toBe(1)
            expect(feature.metadata.tags?.[0].name).toBe('@feature-tag')

            // Check scenario tags
            const scenario = feature.children[0]
            expect(scenario.metadata.tags).toBeDefined()
            expect(scenario.metadata.tags?.length).toBe(1)
            expect(scenario.metadata.tags?.[0].name).toBe('@scenario-tag')

            // Check outline tags
            const outline = feature.children[1]
            expect(outline.metadata.tags).toBeDefined()
            expect(outline.metadata.tags?.length).toBe(1)
            expect(outline.metadata.tags?.[0].name).toBe('@outline-tag')

            // Check examples tags
            const examples = outline.children[2]
            expect(examples.metadata.tags).toBeDefined()
            expect(examples.metadata.tags?.length).toBe(1)
            expect(examples.metadata.tags?.[0].name).toBe('@examples-tag')
        })

        it('should parse feature with rules correctly', () => {
            // Execute
            const features = parseCucumberFeature.call(mockContext, featureWithRules, 'rules-feature.feature')

            // Verify
            expect(features.length).toBe(1)

            // Check feature
            const feature = features[0]
            expect(feature.type).toBe('feature')
            expect(feature.name).toBe('Rules Example')
            expect(feature.children.length).toBe(2) // 2 rules

            // Check first rule
            const firstRule = feature.children[0]
            expect(firstRule.type).toBe('rule')
            expect(firstRule.name).toBe('First business rule')
            expect(firstRule.children.length).toBe(3) // Background + 2 scenarios

            // Check rule background
            expect(firstRule.children[0].type).toBe('background')

            // Check second rule
            const secondRule = feature.children[1]
            expect(secondRule.type).toBe('rule')
            expect(secondRule.name).toBe('Second business rule')
            expect(secondRule.children.length).toBe(1) // 1 scenario
        })

        it('should parse data tables and doc strings correctly', () => {
            // Execute
            const features = parseCucumberFeature.call(
                mockContext,
                featureWithDataTableAndDocString,
                'complex-feature.feature'
            )

            // Verify
            expect(features.length).toBe(1)

            // Check data table
            const dataTableScenario = features[0].children[0]
            const dataTableStep = dataTableScenario.children[0]
            expect(dataTableStep.metadata.dataTable).toBeDefined()
            expect(dataTableStep.metadata.dataTable?.length).toBe(3) // Header + 2 rows
            expect(dataTableStep.metadata.dataTable?.[0]).toEqual(['name', 'email', 'role'])
            expect(dataTableStep.metadata.dataTable?.[1]).toEqual(['John', 'john@test.com', 'admin'])

            // Check doc string
            const docStringScenario = features[0].children[1]
            const docStringStep = docStringScenario.children[0]
            expect(docStringStep.metadata.docString).toBeDefined()
            expect(docStringStep.metadata.docString).toContain('"user"')
            expect(docStringStep.metadata.docString).toContain('"permissions"')
        })

        it('should handle invalid feature content with appropriate error', () => {
            // Execute & Verify
            expect(() =>
                parseCucumberFeature.call(mockContext, invalidFeatureContent, 'invalid-feature.feature')
            ).toThrow('Failed to parse feature file invalid-feature.feature')
        })

        it('should log debug information', () => {
            // Execute
            parseCucumberFeature.call(mockContext, basicFeatureContent, 'basic-feature.feature')

            // Verify debug log was called
            expect(mockContext.log.debug).toHaveBeenCalledWith('Cucumber parser is used.')
        })

        it('should include proper source ranges for each element', () => {
            // Execute
            const features = parseCucumberFeature.call(mockContext, basicFeatureContent, 'ranges-feature.feature')

            // Verify all elements have range information
            function verifyRanges(testCase: CucumberTestData) {
                expect(testCase.range).toBeDefined()
                expect(testCase.range.start).toBeDefined()
                expect(testCase.range.end).toBeDefined()
                expect(typeof testCase.range.start.line).toBe('number')
                expect(typeof testCase.range.start.column).toBe('number')
                expect(typeof testCase.range.end.line).toBe('number')
                expect(typeof testCase.range.end.column).toBe('number')

                // Verify line and column are logical
                if (testCase.range.start.line === testCase.range.end.line) {
                    expect(testCase.range.start.column).toBeLessThanOrEqual(testCase.range.end.column)
                } else {
                    expect(testCase.range.start.line).toBeLessThan(testCase.range.end.line)
                }

                // Verify all children have ranges too
                testCase.children.forEach(verifyRanges)
            }

            features.forEach(verifyRanges)
        })
    })

    describe('readFeatureFile', () => {
        it('should read file content correctly', async () => {
            // Setup
            const mockContent = 'Feature: Test Feature'
            vi.mocked(fs.readFile).mockResolvedValue(mockContent)

            // Execute
            const content = await readFeatureFile('test.feature')

            // Verify
            expect(content).toBe(mockContent)
            expect(fs.readFile).toHaveBeenCalledWith('test.feature', { encoding: 'utf8' })
        })

        it('should handle file reading errors', async () => {
            // Setup
            vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'))

            // Execute & Verify
            await expect(readFeatureFile('missing.feature')).rejects.toThrow('File reading error: File not found')
        })
    })
})
