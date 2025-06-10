import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const reporterIdentifierName = 'VscodeJsonReporter'
const VSCODE_REPORTER_PATH = path.resolve(__dirname, 'reporter.cjs')

/**
 * Since Windows cannot import by reporter file path due to issues with
 * the `initializePlugin` method of wdio-utils, the policy is to create a temporary configuration file.
 */
export async function createTempConfigFile(filename: string, outDir: string): Promise<string> {
    try {
        const absoluteConfigPath = path.resolve(filename)

        const configModule = await import(pathToFileURL(absoluteConfigPath).href)
        const config = configModule.default || configModule.config

        const existingReporters = config.reporters || []

        const customReporterConfig = [
            `${reporterIdentifierName}.default || ${reporterIdentifierName}`,
            {
                stdout: true,
                outputDir: outDir.replace(/\\/g, '\\\\'),
            },
        ]

        const modifiedReporters = [customReporterConfig, ...existingReporters]

        const modifiedConfig = {
            ...config,
            reporters: modifiedReporters,
        }

        const configContent = await generateConfigContentWithImport(modifiedConfig, path.extname(filename), filename)
        const ext = path.extname(filename)
        const outputPath = path.join(path.dirname(filename), `wdio-vscode-${new Date().getTime()}${ext}`)

        await fs.writeFile(outputPath, configContent, 'utf8')

        return outputPath
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Failed to update configuration file:', msg)
        throw error
    }
}

async function generateConfigContentWithImport(
    config: any,
    fileExtension: string,
    originalConfigPath: string
): Promise<string> {
    let existingImports = ''
    try {
        const originalContent = await fs.readFile(originalConfigPath, 'utf8')
        const importMatches = originalContent.match(/^import.*?;/gm)
        if (importMatches) {
            existingImports = importMatches.join('\n') + '\n'
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.warn('Failed to import configuration:', msg)
    }

    const customImport = `import ${reporterIdentifierName} from '${pathToFileURL(VSCODE_REPORTER_PATH).href}';\n`

    const configCopy = { ...config }
    const reporters = configCopy.reporters
    delete configCopy.reporters

    let configString = objectToCodeString(configCopy, 1)

    const reportersString = buildReportersString(reporters)

    configString = configString.slice(0, -1) + `,\n  reporters: ${reportersString}\n}`

    const exportLine = 'export const config = '

    return `${existingImports}${customImport}
${exportLine}${configString};
`
}

function buildReportersString(reporters: any[]): string {
    const reporterItems = reporters.map((reporter) => {
        if (Array.isArray(reporter)) {
            const [reporterName, options] = reporter

            if (typeof reporterName === 'string' && reporterName.includes(reporterIdentifierName)) {
                const optionsString = objectToCodeString(options, 2)
                    .split('\n')
                    .map((line) => `    ${line}`)
                    .join('\n')
                return `[${reporterName}, ${optionsString}]`
            }

            const optionsString = objectToCodeString(options, 2)
                .split('\n')
                .map((line) => `    ${line}`)
                .join('\n')
            return `['${reporterName}', ${optionsString}]`
        }
        return `'${reporter}'`
    })

    return `[\n    ${reporterItems.join(',\n    ')}\n  ]`
}
function objectToCodeString(obj: any, indent = 0): string {
    const spaces = '  '.repeat(indent)
    const nextSpaces = '  '.repeat(indent + 1)

    if (obj === null) {
        return 'null'
    }
    if (obj === undefined) {
        return 'undefined'
    }
    if (typeof obj === 'string') {
        return `'${obj.replace(/'/g, "\\'")}'`
    }
    if (typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj)
    }
    if (typeof obj === 'function') {
        return obj.toString().replace(/\n/g, `\n${nextSpaces}`)
    }

    if (Array.isArray(obj)) {
        if (obj.length === 0) {
            return '[]'
        }
        const items = obj.map((item) => `${nextSpaces}${objectToCodeString(item, indent + 1)}`)
        return `[\n${items.join(',\n')}\n${spaces}]`
    }

    if (typeof obj === 'object') {
        const keys = Object.keys(obj)
        if (keys.length === 0) {
            return '{}'
        }

        const items = keys.map((key) => {
            const strKey = key.indexOf(':') > 0 ? `'${key}'` : key
            const value = objectToCodeString(obj[key], indent + 1)
            return `${nextSpaces}${strKey}: ${value}`
        })

        return `{\n${items.join(',\n')}\n${spaces}}`
    }

    return String(obj)
}

export function isWindows(): boolean {
    return process.platform === 'win32'
}
