import * as fs from 'node:fs'
import type { SourceRange, TestData } from '@vscode-wdio/types/worker'

type SuitePosition = { startLine: number; endLine: number }

export type ExTestData = TestData & {
    parent: string
    filename: string
}

export function enhanceWithPositions(frameworkStructure: ExTestData[]) {
    const enhanced: ExTestData[] = []

    for (const suite of frameworkStructure) {
        const enhancedSuite = enhanceSuite(suite)
        enhanced.push(enhancedSuite)
    }

    return enhanced
}

function enhanceSuite(suite: any, parentPosition?: SuitePosition): ExTestData {
    const filePath = suite.filename
    const code = fs.readFileSync(filePath, 'utf8')
    const lines = code.split('\n')

    const suitePosition = findSuitePosition(lines, suite.name, parentPosition)

    if (suitePosition === null) {
        const fallbackPosition = parentPosition || { startLine: 1, endLine: lines.length }
        return {
            ...suite,
            range: createRange(fallbackPosition.startLine, fallbackPosition.endLine),
            children: suite.children?.map((child: any) => enhanceChild(child, lines, fallbackPosition)) || [],
        }
    }

    const enhanced: ExTestData = {
        ...suite,
        range: createRange(suitePosition.startLine, suitePosition.endLine),
        children: [],
    }

    for (const child of suite.children || []) {
        const enhancedChild = enhanceChild(child, lines, suitePosition)
        enhanced.children.push(enhancedChild)
    }

    return enhanced
}

function enhanceChild(child: any, lines: string[], parentPosition: SuitePosition): TestData {
    if (child.type === 'suite') {
        return enhanceSuite(child, parentPosition)
    } else if (child.type === 'test') {
        const testPosition = findTestPosition(lines, child, parentPosition)
        return {
            ...child,
            range: createRange(testPosition.startLine, testPosition.endLine),
            children: [],
        }
    }

    return {
        ...child,
        range: createRange(parentPosition.startLine, parentPosition.endLine),
        children: [],
    }
}

function findSuitePosition(lines: string[], suiteTitle: string, parentPosition?: SuitePosition): SuitePosition | null {
    const escapedTitle = escapeRegex(suiteTitle)
    const suitePattern = new RegExp(`^\\s*describe\\s*\\(\\s*['"\`]${escapedTitle}['"\`]`)

    const searchStart = parentPosition ? parentPosition.startLine - 1 : 0
    const searchEnd = parentPosition ? parentPosition.endLine : lines.length

    for (let i = searchStart; i < searchEnd; i++) {
        const line = lines[i]
        if (suitePattern.test(line)) {
            const startLine = i + 1 // 1-based
            const endLine = findClosingBrace(lines, i, searchEnd)

            if (endLine !== null) {
                return { startLine, endLine }
            }
        }
    }

    return null
}

function findTestPosition(lines: string[], test: any, suitePosition: SuitePosition): SuitePosition {
    const staticPosition = findStaticTest(lines, test.name, suitePosition)
    if (staticPosition) {
        return staticPosition
    }

    return {
        startLine: suitePosition.startLine,
        endLine: suitePosition.endLine,
    }
}

function findStaticTest(lines: string[], testTitle: string, suitePosition: SuitePosition): SuitePosition | null {
    // 1. Attempt exact match (string literal)
    const exactMatch = findExactMatch(lines, testTitle, suitePosition)
    if (exactMatch) {
        return exactMatch
    }

    // 2. Attempt partial matching of template literals
    const templateMatch = findTemplateMatch(lines, testTitle, suitePosition)
    if (templateMatch) {
        return templateMatch
    }

    return null
}

function findExactMatch(lines: string[], testTitle: string, suitePosition: SuitePosition): SuitePosition | null {
    const escapedTitle = escapeRegex(testTitle)
    const testPattern = new RegExp(`^\\s*it\\s*\\(\\s*['"\`]${escapedTitle}['"\`]`)

    for (let i = suitePosition.startLine - 1; i < suitePosition.endLine; i++) {
        const line = lines[i]
        if (testPattern.test(line)) {
            const startLine = i + 1 // 1-based
            const endLine = findClosingBrace(lines, i, suitePosition.endLine)

            if (endLine !== null) {
                return { startLine, endLine }
            }
        }
    }

    return null
}

function findTemplateMatch(lines: string[], testTitle: string, suitePosition: SuitePosition): SuitePosition | null {
    const templatePattern = /^\s*it\s*\(\s*`([^`]*\$\{[^}]*\}[^`]*)`/

    for (let i = suitePosition.startLine - 1; i < suitePosition.endLine; i++) {
        const line = lines[i]
        const match = templatePattern.exec(line)

        if (match) {
            const template = match[1]
            if (matchesTemplate(testTitle, template)) {
                const startLine = i + 1 // 1-based
                const endLine = findClosingBrace(lines, i, suitePosition.endLine)

                if (endLine !== null) {
                    return { startLine, endLine }
                }
            }
        }
    }

    return null
}

function matchesTemplate(testTitle: string, template: string): boolean {
    // ex: "should test ${name} functionality" -> "should test .* functionality"
    const pattern = template
        .replace(/\$\{[^}]*\}/g, '.*')
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\.\\\*/g, '.*')

    const regex = new RegExp(`^${pattern}$`)
    return regex.test(testTitle)
}

function findClosingBrace(lines: string[], startIndex: number, maxEndIndex?: number): number | null {
    let braceCount = 0
    let foundOpen = false
    const searchLimit = Math.min(maxEndIndex || lines.length, startIndex + 1000)

    for (let i = startIndex; i < searchLimit; i++) {
        for (const char of lines[i]) {
            if (char === '{') {
                braceCount++
                foundOpen = true
            } else if (char === '}' && foundOpen) {
                braceCount--
                if (braceCount === 0) {
                    return i + 1 // 1-based line number
                }
            }
        }
    }

    return Math.min(startIndex + 10, searchLimit)
}

function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function createRange(start: number, end: number): SourceRange {
    return {
        start: {
            line: start - 1,
            column: 0,
        },
        end: {
            line: end - 1,
            column: 0,
        },
    }
}
