import { resolve } from 'node:path'

import * as vscode from 'vscode'

import { TestRunner } from './run.js'
import { WdioExtensionWorker } from './worker.js'
import { log } from '../utils/logger.js'

let debuggerId = 0
const DEBUGGER_NAME = 'wdio-debugger'
const WORKER_PATH = resolve(__dirname, 'worker/index.cjs')

export class DebugSessionTerminatedError extends Error {
    constructor(message = 'Debug session was terminated during test execution') {
        super(message)
        this.name = 'DebugSessionTerminatedError'
    }
}

export class DebugRunner extends TestRunner {
    private _runController: AbortController | null = null

    constructor(
        workspaceFolder: vscode.WorkspaceFolder | undefined,
        token: vscode.CancellationToken,
        workerCwd: string,
        worker = new WdioExtensionDebugWorker(`#DEBUGGER${debuggerId++}`, workerCwd, workspaceFolder, token)
    ) {
        super(worker)

        worker.setDebugTerminationCallback(() => {
            if (this._runController) {
                this._runController.abort(new DebugSessionTerminatedError())
            }
        })
    }

    public override async run(test: vscode.TestItem) {
        this._runController = new AbortController()

        try {
            await this.worker.start()
            await this.worker.waitForStart()

            const runPromise = Promise.race([
                super.run(test),
                new Promise<never>((_, reject) => {
                    this._runController!.signal.addEventListener('abort', () => {
                        const reason = this._runController!.signal.reason || new DebugSessionTerminatedError()
                        reject(reason)
                    })
                }),
            ])

            return await runPromise
        } catch (error) {
            if (error instanceof DebugSessionTerminatedError) {
                log.error('[DEBUG] Test execution interrupted: debug session terminated')
            }
            throw error
        } finally {
            this._runController = null
        }
    }

    public async dispose(): Promise<void> {
        await this.worker.stop()
    }
}

export class WdioExtensionDebugWorker extends WdioExtensionWorker {
    private _deferredPromise = promiseWithResolvers<void>()
    private _session: vscode.DebugSession | undefined = undefined
    private _debugTerminationCallback: (() => void) | null = null

    constructor(
        cid: string = '#0',
        cwd: string,
        private _workspaceFolder: vscode.WorkspaceFolder | undefined,
        private _token: vscode.CancellationToken
    ) {
        super(cid, cwd)
    }

    /**
     * Set a callback to be called when the debug session terminates
     */
    public setDebugTerminationCallback(callback: () => void): void {
        this._debugTerminationCallback = callback
    }

    /**
     * Start the worker process
     */
    public override async start(): Promise<void> {
        try {
            const wsUrl = await this.getServer()

            vscode.debug
                .startDebugging(this._workspaceFolder, {
                    __name: DEBUGGER_NAME,
                    name: 'Debug Tests',
                    type: 'node',
                    request: 'launch',
                    cwd: this.cwd,
                    program: WORKER_PATH,
                    autoAttachChildProcesses: true,
                    env: {
                        ...process.env,
                        WDIO_EXTENSION_WORKER_CID: this.cid,
                        WDIO_EXTENSION_WORKER_WS_URL: wsUrl,
                        FORCE_COLOR: '1',
                        ELECTRON_RUN_AS_NODE: undefined,
                    },
                })
                .then(
                    (resolved) => {
                        if (resolved) {
                            log.info('[DEBUG] Debugging started.')
                        } else {
                            this._deferredPromise.reject(
                                new Error('Failed to start debugging. See output for more information.')
                            )
                            log.error('[DEBUG] Debugging failed')
                        }
                    },
                    (error) => {
                        this._deferredPromise.reject(new Error('Failed to start debugging', { cause: error }))
                        log.error('[DEBUG] Start debugging failed')
                        log.error(error.toString())
                    }
                )

            const onDidStart = vscode.debug.onDidStartDebugSession(async (session) => {
                if (session.configuration.__name !== DEBUGGER_NAME) {
                    return
                }
                if (this._token.isCancellationRequested) {
                    log.info('[DEBUG] Debugging cancel requested.')
                    vscode.debug.stopDebugging(session)
                    return
                }
                this._session = session
                this._token.onCancellationRequested(async () => {
                    log.info('[DEBUG] Debugging cancel requested.')
                    await this.stop()
                    await vscode.debug.stopDebugging(session)
                })

                log.debug('[DEBUG] Debugging started completely.')
                this._deferredPromise.resolve()
            })

            const onDidTerminate = vscode.debug.onDidTerminateDebugSession((session) => {
                if (session.configuration.__name !== DEBUGGER_NAME) {
                    return
                }

                if (this._debugTerminationCallback) {
                    log.debug('[DEBUG] Debug session terminated, calling termination callback.')
                    this._debugTerminationCallback()
                }

                this.disposables.reverse().forEach((d) => d.dispose())
            })

            this.disposables.push(onDidStart, onDidTerminate)
        } catch (error) {
            log.debug(`Failed to start worker: ${error instanceof Error ? error.message : String(error)}`)
            this.stop()
            throw error
        }
    }

    public override async waitForStart(): Promise<void> {
        log.debug('[DEBUG] Wait for connecting worker process.')
        await super.waitForStart()
        await this._deferredPromise.promise
        log.debug('[DEBUG] The worker process connected.')
    }

    public override async stop() {
        await super.stop()
        if (this._session) {
            await vscode.debug.stopDebugging()
            this._session = undefined
        }
    }
}

export function promiseWithResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: any) => void
    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })
    return { promise, resolve, reject }
}
