import type { RunCommandArguments } from '@wdio/cli'
import type { ExtensionApi, RunTestOptions, TestResult } from '../api/types.js'

export function createHandler(client: ExtensionApi) {
    return {
        /**
         * Run WebDriverIO tests
         */
        async runTest(options: RunTestOptions): Promise<TestResult> {
            client.log(`Running tests with options: ${JSON.stringify(options)}`)

            try {
                // Prepare launcher options
                const wdioArgs: RunCommandArguments = {
                    configPath: options.configPath,
                }

                // Add specs if provided
                if (options.specs && options.specs.length > 0) {
                    wdioArgs.spec = options.specs
                }

                // TODO: support the Jasmine, and Cucumber.js
                // Add grep pattern if provided
                if (options.grep) {
                    wdioArgs.mochaOpts = { grep: options.grep }
                }

                client.log(`Launching WebDriverIO with configuration: ${JSON.stringify(wdioArgs)}`)

                // Track output
                let outputText = ''
                const captureOutput = (msg: string) => {
                    outputText += msg + '\n'
                }
                let stderrText = ''
                const captureStderr = (msg: string) => {
                    stderrText += msg + '\n'
                }

                const wdioCliModule = require.resolve('@wdio/cli', {
                    paths: [options.rootDir],
                })
                // eslint-disable-next-line @typescript-eslint/consistent-type-imports
                const { Launcher } = (await import(wdioCliModule)) as typeof import('@wdio/cli')

                // Create launcher instance
                const launcher = new Launcher(options.configPath, wdioArgs)
                // Setup console capture
                const originalConsoleLog = console.log
                const originalConsoleError = console.error

                console.log = (...args: any[]) => {
                    const message = args.join(' ')
                    captureOutput(message)

                    // Report progress based on output patterns
                    if (message.includes('Running')) {
                        // this.api.reportProgress({ message: 'Running tests...' })
                    }
                }

                console.error = (...args: any[]) => {
                    const message = args.join(' ')
                    captureStderr(message)
                }

                // Run tests and get return code
                // this.api.reportProgress({ message: 'Initializing WebDriverIO...' })
                const exitCode = await launcher.run()

                // Restore console functions
                console.log = originalConsoleLog
                console.error = originalConsoleError

                client.log(`Tests completed with exit code: ${exitCode}`)

                return {
                    success: exitCode === 0,
                    stdout: extractResultJson(outputText),
                    stderr: stderrText,
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error)
                const stack = error instanceof Error ? error.stack : ''
                client.log(`Error in WebDriverIO runner: ${errorMessage}`)

                return {
                    success: false,
                    stdout: `Error launching WebDriverIO: ${errorMessage}${stack ? '\n' + stack : ''}`,
                    error: errorMessage,
                }
            }
        },

        ping: async function (): Promise<string> {
            return 'pong'
        },
        shutdown: async function (): Promise<void> {
            client.log('Shutting down worker process')
            // Give some time for the message to be sent before exiting
            setTimeout(() => process.exit(0), 100)
        },
    }
}

type JsonResult = {
    start: number
    end: number
    json: string
}

function extractResultJson(text: string) {
    let start = 0
    let result = ''
    while (start >= 0) {
        //     client.log(`=>>> ${start}`)
        const _result = extractJsonString(text, start + 1)
        if (_result.start > 0) {
            result = result.length === 0 ? `[${_result.json}` : `${result},${_result.json}`
        }
        start = _result.end
    }
    result = `${result}]`
    return result
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
