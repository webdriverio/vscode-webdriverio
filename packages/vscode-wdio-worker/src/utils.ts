import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { resolve } from 'import-meta-resolve'

import type { WorkerMetaContext } from '@vscode-wdio/types'
import type { createTempConfigFile } from './config.js'

export type TempConfigFileCreator = typeof createTempConfigFile

const VSCODE_WINDOWS_CONFIG_CREATOR_PATH = path.resolve(__dirname, 'parser/ast.cjs')

let tempConfigCreator: TempConfigFileCreator | undefined

export async function getTempConfigCreator(context: WorkerMetaContext): Promise<TempConfigFileCreator> {
    return (await dynamicLoader(
        context,
        tempConfigCreator,
        VSCODE_WINDOWS_CONFIG_CREATOR_PATH,
        'createTempConfigFile'
    )) as TempConfigFileCreator
}

export function isWindows() {
    return process.platform === 'win32'
}

type PackageJson = { name: string; version: string }

export async function isFixedWdio(this: WorkerMetaContext, configPath: string) {
    try {
        const pkgName = '@wdio/utils'
        this.log.debug(`Try to detect the version of ${pkgName}`)
        const utilEntryPoint = resolve(`${pkgName}`, resolve('@wdio/cli', pathToFileURL(configPath).href))
        const utilPkg = await findPackageJson(fileURLToPath(utilEntryPoint))
        if (!utilPkg) {
            throw new Error(`Could not detect the entry point of ${pkgName}`)
        }
        const pkg = JSON.parse(await fs.readFile(utilPkg, { encoding: 'utf-8' })) as PackageJson
        if (pkg.name !== pkgName) {
            throw new Error(`Could not detect the version of ${pkgName}`)
        }
        this.log.debug(`Detected version of ${pkgName}@${pkg.version}`)
        const versions = pkg.version.split('.')

        if (Number(versions[0]) >= 10 || (Number(versions[0]) >= 9 && Number(versions[1]) >= 16)) {
            return true
        }
        this.log.debug(`Use temporary configuration files ${pkgName}@${pkg.version} < 9.16.0`)
        return false
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        this.log.debug(`Use temporary configuration files because ${msg}`)
        return false
    }
}

async function findPackageJson(startPath: string) {
    let dir = path.dirname(startPath)
    const root = path.parse(dir).root

    while (dir !== root) {
        const pkgPath = path.join(dir, 'package.json')
        try {
            await fs.access(pkgPath)
            return pkgPath
        } catch {
            dir = path.dirname(dir)
        }
    }

    return undefined
}

export async function dynamicLoader(
    context: WorkerMetaContext,
    libModule: unknown,
    modulePath: string,
    fnName: string
): Promise<unknown> {
    if (libModule) {
        context.log.debug(`Use cached ${path.dirname(modulePath)}`)
        return libModule
    }
    context.log.debug(`Import ${path.basename(modulePath)}`)
    libModule = (await import(pathToFileURL(modulePath).href))[fnName]
    return libModule
}
