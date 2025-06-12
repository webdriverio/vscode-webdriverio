import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'

import { getLauncherInstance } from './cli.js'
import { getTempConfigCreator, isWindows, type TempConfigFileCreator } from './utils.js'
import type { RunTestOptions, TestResultData } from '@vscode-wdio/types/api'
import type { ResultSet } from '@vscode-wdio/types/reporter'
import type { LoggerInterface } from '@vscode-wdio/types/utils'
import type { WorkerMetaContext } from '@vscode-wdio/types/worker'
import type { RunCommandArguments } from '@wdio/cli'

const VSCODE_REPORTER_PATH = resolve(__dirname, 'reporter.cjs')

let tempConfigCreator: TempConfigFileCreator | undefined

export async function runTest(this: WorkerMetaContext, options: RunTestOptions): Promise<TestResultData> {
    const outputDir = await getOutputDir.call(this)
    let configFile: string | undefined = undefined
    try {
        // Prepare launcher options
        const wdioArgs: RunCommandArguments = {
            configPath: options.configPath,
        }

        // Add specs if provided
        if (options.specs && options.specs.length > 0) {
            wdioArgs.spec = isWindows()
                ? options.specs.map((spec) => spec.replace(/^([a-z]):/, (_match, p1) => `${p1.toUpperCase()}:`))
                : options.specs
        }

        // Add grep pattern if provided
        if (options.grep) {
            wdioArgs.mochaOpts = { grep: options.grep }
            wdioArgs.jasmineOpts = { grep: options.grep }
        }

        // ensure log directory exists if needed
        if (process.env.WDIO_LOG_PATH) {
            const logPath = dirname(process.env.WDIO_LOG_PATH)
            const logDir = isAbsolute(logPath) ? logPath : join(this.cwd, logPath)
            this.log.debug(`Create the log directory: ${logDir}`)
            await fs.mkdir(logDir, { recursive: true })
        }

        if (isWindows()) {
            const creator = await getTempConfigCreator(tempConfigCreator)
            configFile = await creator(options.configPath, outputDir.json!)
            options.configPath = configFile
            wdioArgs.configPath = configFile
        }

        // The `stdout` must be true because the name of the logger is
        // the name of the file and the initialization of Write Stream will fail.
        if (!isWindows()) {
            wdioArgs.reporters = [[VSCODE_REPORTER_PATH, { stdout: true, outputDir: outputDir.json }]]
        }

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
        const launcher = await getLauncherInstance(options.configPath, wdioArgs)

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

        let exitCode: number | undefined
        try {
            // Run tests and get return code
            exitCode = await launcher.run()
        } catch (error) {
            originalConsoleLog(outputText)
            originalConsoleError(stderrText)
            throw error
        } finally {
            // Restore console functions
            console.log = originalConsoleLog
            console.error = originalConsoleError
        }

        this.log.info(`Tests completed with exit code: ${exitCode}`)

        return {
            success: exitCode === 0,
            stdout: outputText,
            stderr: stderrText,
            json: await extractResultJson(this.log, outputDir.json),
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const stack = error instanceof Error ? error.stack : ''
        this.log.error(`Error in WebdriverIO runner: ${errorMessage}`)

        return {
            success: false,
            stdout: `Error launching WebdriverIO: ${errorMessage}${stack ? '\n' + stack : ''}`,
            error: errorMessage,
            json: [],
        }
    } finally {
        if (outputDir.json) {
            await removeResultDir(this.log, outputDir.json)
        }
        if (isWindows() && configFile) {
            try {
                this.log.debug(`Remove temp config file...: ${configFile}`)
                await fs.rm(configFile, { recursive: true, force: true })
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error)
                this.log.debug(`Failed to remove temp config file: ${errorMessage}`)
                // pass
            }
        }
    }
}

async function getOutputDir(this: WorkerMetaContext) {
    const resultRootDir = join(os.tmpdir(), 'vscode-webdriverio')
    try {
        await fs.mkdir(resultRootDir, { recursive: true })
        const json = await fs.mkdtemp(join(resultRootDir, 'result-'))
        this.log.debug(`Json log directory: ${json}`)
        return { json }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.log.debug(`Failed to create output directory: ${errorMessage}`)
        return { json: undefined }
    }
}

async function extractResultJson(log: LoggerInterface, outputDir: string | undefined): Promise<ResultSet[]> {
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

            return data as ResultSet[]
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            log.debug(`Result file could not be read: ${errorMessage}`)
        }
    }
    return []
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
