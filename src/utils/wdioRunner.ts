import * as path from 'node:path'
import * as cp from 'node:child_process'
import * as fs from 'node:fs'
import type * as vscode from 'vscode'

import log from './logger.js'
import which from 'which'

export interface WdioRunOptions {
    rootDir: string
    configPath: string
    specs?: string[]
    grep?: string
    range?: vscode.Range
}

export interface WdioRunResult {
    success: boolean
    output: string
    stats?: {
        passed: number
        failed: number
        skipped: number
        total: number
    }
}

/**
 * Run WebDriverIO tests with the given options
 */
export async function runWdio(options: WdioRunOptions): Promise<WdioRunResult> {
    const node = await which('node', { nothrow: true })
    return new Promise((resolve, reject) => {
        // Validate config file
        if (!fs.existsSync(options.configPath)) {
            reject(new Error(`Config file not found: ${options.configPath}`))
            return
        }

        // Build command args
        const args = ['wdio', 'run', options.configPath]

        // Add specs if provided
        if (options.specs) {
            options.specs.forEach((spec) => {
                args.push('--spec', spec)
            })
        }

        // Add grep pattern if provided
        if (options.grep) {
            args.push('--mochaOpts.grep', `'${options.grep}'`) //'--jasmineOpts.grep', `"${options.grep}"`
        }

        // Get WebDriverIO path
        const result = require.resolve('@wdio/cli', {
            paths: [options.rootDir],
        })

        const wdioBin = path.resolve(path.join(path.dirname(result), '..', 'bin', 'wdio.js'))

        // Determine command
        process.chdir(options.rootDir)
        const cmdArgs = [wdioBin, ...args.slice(1)]
        const env = { ...process.env, FORCE_COLOR: '0' }
        // @ts-expect-error
        delete env.ELECTRON_RUN_AS_NODE

        log.appendLine(`command: ${node}`)
        log.appendLine(`args   : ${cmdArgs.join(' ')}`)
        // Run command
        let output = ''
        const proc = cp.spawn(node!, cmdArgs, {
            cwd: options.rootDir,
            env,
            shell: true,
        })

        // Collect output
        proc.stdout.on('data', (data) => {
            const chunk = data.toString()
            output += chunk
        })

        proc.stderr.on('data', (data) => {
            const chunk = data.toString()
            output += chunk
        })

        // Handle completion
        proc.on('close', (code) => {
            // Parse results from output
            const stats = parseResults(output)
            log.appendLine('==== result ====')
            log.appendLine(output)

            resolve({
                success: code === 0,
                output,
                stats,
            })
        })

        proc.on('error', (err) => {
            reject(err)
        })
    })
}

/**
 * Parse test results from WebDriverIO output
 */
function parseResults(output: string): WdioRunResult['stats'] {
    // Default stats
    const stats = {
        passed: 0,
        failed: 0,
        skipped: 0,
        total: 0,
    }

    // Try to extract results from output
    // This is a simple regex - you might need to adjust based on WebDriverIO output format
    const resultMatch = output.match(/(\d+) passing.*?(\d+) failing.*?(\d+) skipped/s)
    if (resultMatch) {
        stats.passed = parseInt(resultMatch[1], 10)
        stats.failed = parseInt(resultMatch[2], 10)
        stats.skipped = parseInt(resultMatch[3], 10)
        stats.total = stats.passed + stats.failed + stats.skipped
    }

    return stats
}
