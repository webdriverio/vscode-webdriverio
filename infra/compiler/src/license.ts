import fss from 'node:fs'
import path from 'node:path'

import chalk from 'chalk'
import { fdir } from 'fdir'
import type { Metafile } from 'esbuild'

type PackageJson = {
    name: string
    version: string
    author?: string | { name: string }
    license?: string
    repository?: { url: string }
}

type LicenseData = PackageJson & {
    license: string
    licenseText: string
    noticeText: string | null
}

export function generateLicense(rootDir: string, pkgPath: string, metadata: Metafile) {
    const baseLicense = path.join(rootDir, 'LICENSE')
    const checker = checkLicense(pkgPath, metadata)
    const license = checker.render(baseLicense)

    const existingLicenseText = fss.existsSync(license.file)
        ? fss.readFileSync(license.file, { encoding: 'utf-8' })
        : ''
    if (existingLicenseText !== license.contents) {
        fss.writeFileSync(license.file, license.contents, { encoding: 'utf-8' })
        console.info(
            chalk.yellow(`\n${path.relative(rootDir, license.file)} was updated. You should commit the updated file.\n`)
        )
    }
}

export function checkLicense(pkgPath: string, meta: any) {
    const inputs = Object.keys(meta.inputs)
    const checker = new LicenseChecker(path.dirname(pkgPath))

    for (const input of inputs) {
        if (input.match(/node_modules/)) {
            const match = Array.from(input.matchAll(/node_modules\/((@[^/]+\/)?[^/]+)/g))

            const relativePath = input.substring(0, match[match.length - 1].index)
            const absEntryPoint = path.resolve(path.dirname(pkgPath), input)
            const absPackageRoot = path.resolve(path.dirname(pkgPath), relativePath)
            const maxDepth = absEntryPoint.split(path.posix.sep).length - absPackageRoot.split(path.posix.sep).length
            checker.findLicense(absEntryPoint, maxDepth)
        }
    }
    return checker
}

class LicenseChecker {
    private _cache = new Map<string, LicenseData>()
    public licenseTypeDependencies = new Set<string>()
    public dependencies = new Map<string, LicenseData>()

    constructor(private _rootDir: string) {}

    findLicense(entryPoint: string, maxDepth: number) {
        let dir = path.dirname(entryPoint)
        let pkg = null
        let cntUpDir = 0

        while (cntUpDir < maxDepth) {
            if (this._cache.has(dir)) {
                pkg = this._cache.get(dir)
                break
            }
            const pkgPath = path.join(dir, 'package.json')
            if (fss.existsSync(pkgPath)) {
                const pkgJson = this._getPkgJson(dir)
                const license = pkgJson.license
                const { name, version } = pkgJson
                const hasLicense = license && license.length > 0
                if (name && version && hasLicense) {
                    // found
                    const licenseText = readFile(dir, ['license', 'licence'])
                    if (!licenseText) {
                        throw new Error(`License text is not found: ${entryPoint}`)
                    }

                    const noticeText = readFile(dir, ['notice', 'CopyrightNotice'])
                    pkg = pkgJson as LicenseData
                    pkg.licenseText = licenseText
                    pkg.noticeText = noticeText
                    this.licenseTypeDependencies.add(license)
                    this._cache.set(dir, pkg)
                    break
                }
            }
            cntUpDir++
            dir = path.resolve(path.join(dir, '..'))
        }
        if (pkg) {
            this.dependencies.set(this._generateKey(pkg.name, pkg.version), pkg)
        } else {
            throw new Error(`License is not found: ${entryPoint}`)
        }
        return pkg
    }

    private _generateKey(name: string, version: string) {
        return `${name}@${version}`
    }

    private _getPkgJson(dir: string) {
        if (this._cache.has(dir)) {
            return this._cache.get(dir)!
        }
        const pkgJson = path.join(dir, 'package.json')
        return JSON.parse(fss.readFileSync(pkgJson, { encoding: 'utf-8' })) as PackageJson
    }

    render(baseLicense: string) {
        const baseLicenseText = fss.readFileSync(baseLicense, { encoding: 'utf-8' })

        const contents: string[] = []
        const rootPkg = this._getPkgJson(this._rootDir)
        contents.push(`# License of ${rootPkg.name}`)
        contents.push(`${rootPkg.name} is released under the MIT license:  `)
        contents.push('')
        contents.push(
            baseLicenseText
                .replace(/\n\r|\r/g, '\n')
                .split('\n')
                .map((line) => `${line}  `)
                .join('\n')
        )
        contents.push('# Licenses of bundled dependencies')
        contents.push('The published extension contains additionally code with the following licenses:  ')
        contents.push(Array.from(this.licenseTypeDependencies).sort().join(', '))
        contents.push('')
        contents.push('# Bundled dependencies:')
        const dependentLicenseTexts: string[] = []
        const sortedDependencies = new Map([...this.dependencies].sort())
        sortedDependencies.forEach((pkg) => {
            const lines: string[] = []
            lines.push(`## ${pkg.name}  `)
            lines.push(`License: ${pkg.license}  `)
            if (pkg.author) {
                if (typeof pkg.author === 'object') {
                    lines.push(`Author: ${pkg.author.name}  `)
                } else {
                    lines.push(`Author: ${pkg.author.split('<')[0].split('(')[0].trim()}  `)
                }
            }
            if (pkg.repository && pkg.repository.url) {
                lines.push(`Repository: ${pkg.repository.url}  `)
            }
            lines.push('### License Text')
            lines.push(
                pkg.licenseText
                    .replace(/\n\r|\r/g, '\n')
                    .split('\n')
                    .map((line) => `> ${line}`)
                    .join('\n')
            )

            if (pkg.noticeText) {
                lines.push('### Notice Text')
                lines.push(
                    pkg.noticeText
                        .replace(/\n\r|\r/g, '\n')
                        .split('\n')
                        .map((line) => `> ${line}`)
                        .join('\n')
                )
            }
            dependentLicenseTexts.push(lines.join('\n'))
        })
        contents.push(dependentLicenseTexts.join('\n\n---------------------------------------\n\n'))

        const licenseFile = path.join(this._rootDir, 'LICENSE.md')
        return {
            file: licenseFile,
            contents: contents.join('\n'),
        }
    }
}

function readFile(dir: string, inputs: string[]) {
    for (const input of inputs) {
        const absolutePath = path.join(dir, input)
        const relativeToDir = path.relative(dir, absolutePath)
        const findings = new fdir().withRelativePaths().filter(pathsMatch(relativeToDir)).crawl(dir).sync()
        const firstPath = findings[0]
        if (firstPath) {
            const file = path.join(dir, firstPath)
            return fss.readFileSync(file, 'utf-8')
        }
    }
    return null
}

/**
 * Returns a predicate function that returns `true` if the given path matches the target path.
 *
 * @param {string} target Target path.
 * @returns {function(*): boolean} Predicate function.
 */
function pathsMatch(target: string): (path: any) => boolean {
    const targetRegExp = generatePattern(target)
    return (p) => targetRegExp.test(p)
}

/**
 * Generate a pattern where all regexp special characters are escaped.
 * @param {string} input Input.
 * @returns {string} Escaped input.
 */
function escapeRegExp(input: string): string {
    return input.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')
}

/**
 * Generate filename pattern for the given input: the generated regexp will match any file
 * starting with `input` (case insensitively).
 *
 * @param {string} input Input.
 * @returns {RegExp} Generated pattern.
 */
function generatePattern(input: string): RegExp {
    const FILE_FORBIDDEN_CHARACTERS = ['#', '%', '&', '*', ':', '<', '>', '?', '/', path.sep, '{', '|', '}'].map((c) =>
        escapeRegExp(c)
    )

    const FILE_SUFFIX_PTN = `[^${FILE_FORBIDDEN_CHARACTERS.join('')}]`
    return new RegExp(`^${input}(${FILE_SUFFIX_PTN})*$`, 'i')
}
