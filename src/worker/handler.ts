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
                const wdioArgs: Record<string, any> = {}

                // Add specs if provided
                if (options.specs && options.specs.length > 0) {
                    wdioArgs.specs = options.specs
                }

                // Add grep pattern if provided
                if (options.grep) {
                    wdioArgs.grep = options.grep
                }

                client.log(`Launching WebDriverIO with configuration: ${JSON.stringify(wdioArgs)}`)

                // Track output
                let outputText = ''
                const captureOutput = (msg: string) => {
                    outputText += msg + '\n'
                    client.log(msg)
                }

                const wdioCliModule = require.resolve('@wdio/cli', {
                    paths: [options.rootDir],
                })
                // const wdioConfigModule = require.resolve('@wdio/config/node', {
                //     paths: [options.rootDir],
                // })
                // eslint-disable-next-line @typescript-eslint/consistent-type-imports
                const { Launcher } = (await import(wdioCliModule)) as typeof import('@wdio/cli')

                // const { ConfigParser } = (await import(wdioConfigModule)) as typeof import('@wdio/config/node')

                // const VSCodeConfig = class VSCodeConfig extends ConfigParser {
                //     override getConfig() {
                //         const config = super.getConfig()
                //         config.reporters = [['json', { stdout: true }]]
                //         return config
                //     }
                // }

                // Create launcher instance
                const launcher = new Launcher(options.configPath, wdioArgs)
                // const config = new VSCodeConfig(options.configPath, wdioArgs)
                // to use the private class for wdio, casting the type
                // launcher.configParser = config as unknown as typeof launcher.configParser

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
                    captureOutput(message)
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
                    output: outputText,
                }
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error)
                const stack = error instanceof Error ? error.stack : ''
                client.log(`Error in WebDriverIO runner: ${errorMessage}`)

                return {
                    success: false,
                    output: `Error launching WebDriverIO: ${errorMessage}${stack ? '\n' + stack : ''}`,
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

// export class WebDriverIOWorker implements WorkerApi {
//     private extensionApi: ExtensionApi | undefined

//     public set rpc(rpc: BirpcReturn<ExtensionApi, WorkerApi>) {
//         this.extensionApi = rpc
//     }
//     private get api() {
//         if (!this.extensionApi) {
//             throw new Error('API is not initialised.')
//         }
//         return this.extensionApi
//     }

//     /**
//      * Log message to extension
//      */
//     private log(message: string): void {
//         this.api.log(`[WORKER] ${message}`)
//     }

//     /**
//      * Run WebDriverIO tests
//      */
//     async runTest(options: RunTestOptions): Promise<TestResult> {
//         this.log(`Running tests with options: ${JSON.stringify(options)}`)

//         try {
//             // Prepare launcher options
//             const wdioArgs: Record<string, any> = {}

//             // Add specs if provided
//             if (options.specs && options.specs.length > 0) {
//                 wdioArgs.specs = options.specs
//             }

//             // Add grep pattern if provided
//             if (options.grep) {
//                 wdioArgs.grep = options.grep
//             }

//             this.log(`Launching WebDriverIO with configuration: ${JSON.stringify(wdioArgs)}`)

//             // Track output
//             let outputText = ''
//             const captureOutput = (msg: string) => {
//                 outputText += msg + '\n'
//                 this.log(msg)
//             }

//             const result = require.resolve('@wdio/cli', {
//                 paths: [options.rootDir],
//             })
//             // eslint-disable-next-line @typescript-eslint/consistent-type-imports
//             const { Launcher } = (await import(result)) as typeof import('@wdio/cli')

//             // Create launcher instance
//             const launcher = new Launcher(options.configPath, wdioArgs)

//             // Setup console capture
//             const originalConsoleLog = console.log
//             const originalConsoleError = console.error

//             console.log = (...args: any[]) => {
//                 const message = args.join(' ')
//                 captureOutput(message)

//                 // Report progress based on output patterns
//                 if (message.includes('Running')) {
//                     // this.api.reportProgress({ message: 'Running tests...' })
//                 }
//             }

//             console.error = (...args: any[]) => {
//                 const message = args.join(' ')
//                 captureOutput(message)
//             }

//             // Run tests and get return code
//             // this.api.reportProgress({ message: 'Initializing WebDriverIO...' })
//             const exitCode = await launcher.run()

//             // Restore console functions
//             console.log = originalConsoleLog
//             console.error = originalConsoleError

//             this.log(`Tests completed with exit code: ${exitCode}`)

//             return {
//                 success: exitCode === 0,
//                 output: outputText,
//             }
//         } catch (error) {
//             const errorMessage = error instanceof Error ? error.message : String(error)
//             const stack = error instanceof Error ? error.stack : ''
//             this.log(`Error in WebDriverIO runner: ${errorMessage}`)

//             return {
//                 success: false,
//                 output: `Error launching WebDriverIO: ${errorMessage}${stack ? '\n' + stack : ''}`,
//                 error: errorMessage,
//             }
//         }
//     }

//     /**
//      * Simple ping method to check if worker is alive
//      */
//     async ping(): Promise<string> {
//         return 'pong'
//     }

//     /**
//      * Shutdown worker process
//      */
//     async shutdown(): Promise<void> {
//         this.log('Shutting down worker process')
//         // Give some time for the message to be sent before exiting
//         setTimeout(() => process.exit(0), 100)
//     }
// }
