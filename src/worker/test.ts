import * as fs from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { Launcher } from './cli.js'

import type { RunCommandArguments } from '@wdio/cli'
import type { WorkerMetaContext } from './types.js'
import type { RunTestOptions, TestResult } from '../api/index.js'
import type { LoggerInterface } from '../types.js'

const VSCODE_REPORTER_PATH = resolve(__dirname, '../reporter/index.cjs')

export async function runTest(this: WorkerMetaContext, options: RunTestOptions): Promise<TestResult> {
    try {
        // Prepare launcher options
        const wdioArgs: RunCommandArguments = {
            configPath: options.configPath,
        }

        // Add specs if provided
        if (options.specs && options.specs.length > 0) {
            wdioArgs.spec = options.specs
        }

        // Add grep pattern if provided
        if (options.grep) {
            wdioArgs.mochaOpts = { grep: options.grep }
            wdioArgs.jasmineOpts = { grep: options.grep }
        }

        wdioArgs.reporters = [[VSCODE_REPORTER_PATH, { stdout: true, outputDir: options.outputDir }]]

        this.log.info('Launching WebdriverIO...')
        this.log.trace(`Configuration: ${JSON.stringify(wdioArgs, null, 2)}`)

        // Track output
        let outputText = ''
        const captureOutput = (msg: string) => {
            outputText += msg + '\n'
        }
        let stderrText = ''
        const captureStderr = (msg: string) => {
            stderrText += msg + '\n'
        }

        // Create launcher instance
        const launcher = new Launcher(options.configPath, wdioArgs)

        // Setup console capture
        const originalConsoleLog = console.log
        const originalConsoleError = console.error

        console.log = (...args: any[]) => {
            const message = args.join(' ')
            captureOutput(message)
        }

        console.error = (...args: any[]) => {
            const message = args.join(' ')
            captureStderr(message)
        }

        // Run tests and get return code
        const exitCode = await launcher.run()

        // Restore console functions
        console.log = originalConsoleLog
        console.error = originalConsoleError

        this.log.info(`Tests completed with exit code: ${exitCode}`)

        return {
            success: exitCode === 0,
            stdout: await extractResultJson(this.log, options.outputDir, outputText),
            stderr: stderrText,
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const stack = error instanceof Error ? error.stack : ''
        this.log.error(`Error in WebdriverIO runner: ${errorMessage}`)

        return {
            success: false,
            stdout: `Error launching WebdriverIO: ${errorMessage}${stack ? '\n' + stack : ''}`,
            error: errorMessage,
        }
    }
}

type JsonResult = {
    start: number
    end: number
    json: string
}

async function extractResultJson(log: LoggerInterface, outputDir: string | undefined, text: string) {
    if (outputDir) {
        try {
            await fs.access(outputDir, fs.constants.R_OK)
            log.debug(`Extract result file from dir: ${outputDir}`)
            const filePattern = 'wdio-.*.json'
            const fileNames = (await fs.readdir(outputDir)).filter((file) => file.match(filePattern))
            const data: unknown[] = []

            await Promise.all(
                fileNames.map(async (fileName) => {
                    log.debug(`Reading files... : ${fileName}`)
                    data.push(JSON.parse((await fs.readFile(join(outputDir, fileName))).toString()))
                })
            )

            await removeResultDir(log, outputDir)

            return JSON.stringify(data)
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            log.debug(`Result file could not be read: ${errorMessage}`)
        }
    }
    // fallback processing
    log.debug('Extract result from stdout.')
    return extractFromStdout(text)
}

async function removeResultDir(log: LoggerInterface, outputDir: string) {
    try {
        log.debug('Remove all files...')
        await fs.rm(outputDir, { recursive: true, force: true })
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        log.debug(`Remove Failed: ${errorMessage}`)
        // pass
    }
}

/**
 * Function to extract the JSON part from a string
 * @param text The target string to search
 * @returns The extracted JSON string, or '{}' if not found
 */
function extractFromStdout(text: string) {
    let start = 0
    const result: string[] = []
    while (start >= 0) {
        //     client.log(`=>>> ${start}`)
        const _result = extractJsonString(text, start + 1)
        if (_result.start > 0) {
            result.push(_result.json)
        }
        start = _result.end
    }
    return `[${result.join(',')}]`
}

/**
 * Function to extract the JSON part from a string
 * @param text The target string to search
 * @returns The extracted JSON string, or '{}' if not found
 */
function extractJsonString(text: string, start = 0): JsonResult {
    // Find the starting position of the JSON
    const startIndex = text.indexOf('{', start)
    if (startIndex === -1) {
        return {
            start: -1,
            end: -1,
            json: '{}',
        }
    }

    // Start parsing from the first opening brace
    let openBraces = 0
    let inString = false
    let escapeNext = false

    for (let i = startIndex; i < text.length; i++) {
        const char = text[i]

        // Handle escape characters inside a string
        if (escapeNext) {
            escapeNext = false
            continue
        }

        // A backslash in a string escapes the next character
        if (inString && char === '\\') {
            escapeNext = true
            continue
        }

        // Toggle string state on encountering a double quote
        if (char === '"') {
            inString = !inString
            continue
        }

        // Do not count braces while inside a string
        if (inString) {
            continue
        }

        // Count opening and closing braces
        if (char === '{') {
            openBraces++
        } else if (char === '}') {
            openBraces--

            // When all opened braces are closed, JSON ends
            if (openBraces === 0) {
                return {
                    start: startIndex,
                    end: i,
                    json: text.substring(startIndex, i + 1),
                }
            }
        }
    }

    // Return empty JSON if properly closed JSON was not found
    return {
        start: -1,
        end: -1,
        json: '{}',
    }
}
