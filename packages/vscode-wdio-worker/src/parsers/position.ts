import * as fs from 'node:fs'
import type { SourceRange, TestData } from '@vscode-wdio/types/worker'

type SuitePosition = { startLine: number; endLine: number }

export type ExTestData = TestData & {
    parent: string
    filename: string
}

export class TestPositionEnhancer {
    enhanceWithPositions(frameworkStructure: ExTestData[]) {
        const enhanced: ExTestData[] = []

        for (const suite of frameworkStructure) {
            const enhancedSuite = this.enhanceSuite(suite)
            enhanced.push(enhancedSuite)
        }

        return enhanced
    }

    private enhanceSuite(suite: any, parentPosition?: SuitePosition): ExTestData {
        const filePath = suite.filename
        const code = fs.readFileSync(filePath, 'utf8')
        const lines = code.split('\n')

        const suitePosition = this.findSuitePosition(lines, suite.name, parentPosition)

        if (suitePosition === null) {
            // 位置が特定できない場合は親の位置を使用
            const fallbackPosition = parentPosition || { startLine: 1, endLine: lines.length }
            return {
                ...suite,
                range: createRange(fallbackPosition.startLine, fallbackPosition.endLine),
                children: suite.children?.map((child: any) => this.enhanceChild(child, lines, fallbackPosition)) || [],
            }
        }

        const enhanced: ExTestData = {
            ...suite,
            range: createRange(suitePosition.startLine, suitePosition.endLine),
            children: [],
        }

        for (const child of suite.children || []) {
            const enhancedChild = this.enhanceChild(child, lines, suitePosition)
            enhanced.children.push(enhancedChild)
        }

        return enhanced
    }

    private enhanceChild(child: any, lines: string[], parentPosition: SuitePosition): TestData {
        if (child.type === 'suite') {
            return this.enhanceSuite(child, parentPosition)
        } else if (child.type === 'test') {
            const testPosition = this.findTestPosition(lines, child, parentPosition)
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

    private findSuitePosition(
        lines: string[],
        suiteTitle: string,
        parentPosition?: SuitePosition
    ): SuitePosition | null {
        const escapedTitle = this.escapeRegex(suiteTitle)
        const suitePattern = new RegExp(`^\\s*describe\\s*\\(\\s*['"\`]${escapedTitle}['"\`]`)

        const searchStart = parentPosition ? parentPosition.startLine - 1 : 0
        const searchEnd = parentPosition ? parentPosition.endLine : lines.length

        for (let i = searchStart; i < searchEnd; i++) {
            const line = lines[i]
            if (suitePattern.test(line)) {
                const startLine = i + 1 // 1-based
                const endLine = this.findClosingBrace(lines, i, searchEnd)

                if (endLine !== null) {
                    return { startLine, endLine }
                }
            }
        }

        return null
    }

    private findTestPosition(lines: string[], test: any, suitePosition: SuitePosition): SuitePosition {
        const staticPosition = this.findStaticTest(lines, test.name, suitePosition)
        if (staticPosition) {
            return staticPosition
        }

        return {
            startLine: suitePosition.startLine,
            endLine: suitePosition.endLine,
        }
    }

    private findStaticTest(lines: string[], testTitle: string, suitePosition: SuitePosition): SuitePosition | null {
        // 1. Attempt exact match (string literal)
        const exactMatch = this.findExactMatch(lines, testTitle, suitePosition)
        if (exactMatch) {
            return exactMatch
        }

        // 2. Attempt partial matching of template literals
        const templateMatch = this.findTemplateMatch(lines, testTitle, suitePosition)
        if (templateMatch) {
            return templateMatch
        }

        return null
    }

    private findExactMatch(lines: string[], testTitle: string, suitePosition: SuitePosition): SuitePosition | null {
        const escapedTitle = this.escapeRegex(testTitle)
        const testPattern = new RegExp(`^\\s*it\\s*\\(\\s*['"\`]${escapedTitle}['"\`]`)

        for (let i = suitePosition.startLine - 1; i < suitePosition.endLine; i++) {
            const line = lines[i]
            if (testPattern.test(line)) {
                const startLine = i + 1 // 1-based
                const endLine = this.findClosingBrace(lines, i, suitePosition.endLine)

                if (endLine !== null) {
                    return { startLine, endLine }
                }
            }
        }

        return null
    }

    private findTemplateMatch(lines: string[], testTitle: string, suitePosition: SuitePosition): SuitePosition | null {
        const templatePattern = /^\s*it\s*\(\s*`([^`]*\$\{[^}]*\}[^`]*)`/

        for (let i = suitePosition.startLine - 1; i < suitePosition.endLine; i++) {
            const line = lines[i]
            const match = templatePattern.exec(line)

            if (match) {
                const template = match[1]
                if (this.matchesTemplate(testTitle, template)) {
                    const startLine = i + 1 // 1-based
                    const endLine = this.findClosingBrace(lines, i, suitePosition.endLine)

                    if (endLine !== null) {
                        return { startLine, endLine }
                    }
                }
            }
        }

        return null
    }

    private matchesTemplate(testTitle: string, template: string): boolean {
        // ex: "should test ${name} functionality" -> "should test .* functionality"
        const pattern = template
            .replace(/\$\{[^}]*\}/g, '.*')
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\\\.\\\*/g, '.*')

        const regex = new RegExp(`^${pattern}$`)
        return regex.test(testTitle)
    }

    private findClosingBrace(lines: string[], startIndex: number, maxEndIndex?: number): number | null {
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

    private escapeRegex(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    private findTestLocation(enhancedStructure: TestData[], testTitle: string): object | null {
        for (const suite of enhancedStructure) {
            const result = this.findTestInSuite(suite, testTitle)
            if (result) {
                return result
            }
        }
        return null
    }
    private findTestInSuite(suite: TestData, testTitle: string): object | null {
        for (const child of suite.children) {
            if (child.type === 'test' && child.name === testTitle) {
                return {
                    name: child.name,
                    startLine: child.range?.start.line ? child.range.start.line + 1 : 1,
                    endLine: child.range?.end.line ? child.range.end.line + 1 : 1,
                    parent: suite.name,
                }
            } else if (child.type === 'suite') {
                const result = this.findTestInSuite(child, testTitle)
                if (result) {
                    return result
                }
            }
        }
        return null
    }
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
