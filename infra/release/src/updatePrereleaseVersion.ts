import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

import { createPreReleaseVer } from './utils.js'
import pkg from '../../../lerna.json' with { type: 'json' }

const isPreRelease = Boolean(process.env.VSCODE_WDIO_PRE_RELEASE_PATCH_NUMBER || '')

if (!isPreRelease) {
    console.log('This release process is not pre-release.')
    process.exit(0)
}

const newVersion = createPreReleaseVer(pkg.version)

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..', '..', '..')

const extensionPackagePath = path.resolve(root, path.join('packages', 'vscode-webdriverio'))

const extensionPackageJson = path.resolve(extensionPackagePath, 'package.json')

const extensionPkg = JSON.parse(fs.readFileSync(extensionPackageJson).toString())

/**
 * VS Code Marketplace version requirements:
 * It must be one to four numbers in the range 0 to 2147483647,
 * with each number separated by a period. It must contain at least one non-zero number.
 */
extensionPkg.version = `${newVersion}`

console.log(`Update package.json with Pre-release version:\n\n${JSON.stringify(extensionPkg, null, 2)}`)
fs.writeFileSync(extensionPackageJson, JSON.stringify(extensionPkg, null, 2))
