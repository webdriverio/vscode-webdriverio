import fss from 'node:fs'
import path from 'node:path'

import { fdir } from 'fdir'

type LicenseData = {
    name: string
    version: string
    author?: string | { name: string }
    repository?: { url: string }
    license: string
    licenseText: string
    noticeText: string | null
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
            checker.findPackageJson(absEntryPoint, maxDepth)
        }
    }
    return checker
}

class LicenseChecker {
    private _cache = new Map<string, LicenseData>()
    public licenseTypeDependencies = new Set<string>()
    public dependencies = new Map<string, LicenseData>()

    constructor(private _rootDir: string) {}

    findPackageJson(entryPoint: string, maxDepth: number) {
        let dir = path.dirname(entryPoint)
        let pkg = null
        let cntUpDir = 0

        while (cntUpDir < maxDepth) {
            if (this._cache.has(dir)) {
                pkg = this._cache.get(dir)
                break
            }
            const pkgPath = path.join(dir, 'package.json')
            const exists = fss.existsSync(pkgPath)
            if (exists) {
                const pkgJson = JSON.parse(fss.readFileSync(pkgPath, { encoding: 'utf-8' }))
                const license = pkgJson.license || pkgJson.licenses
                const { name, version } = pkgJson
                const hasLicense = license && license.length > 0
                if ((name && version) || hasLicense) {
                    // found
                    const licenseText = readFile(dir, ['license', 'licence'])
                    if (!licenseText) {
                        throw new Error(`License text is not found: ${entryPoint}`)
                    }

                    const noticeText = readFile(dir, ['notice'])
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

    private _getPkgName() {
        const pkgJson = path.join(this._rootDir, 'package.json')
        const pkg = JSON.parse(fss.readFileSync(pkgJson, { encoding: 'utf-8' })) as { name: string }
        return pkg.name
    }

    render(baseLicense: string) {
        const baseLicenseText = fss.readFileSync(baseLicense, { encoding: 'utf-8' })

        const contents: string[] = []
        contents.push(`# License of ${this._getPkgName()}`)
        contents.push(`${this._getPkgName()} is released under the MIT license:  `)
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
        const dependencies: string[] = []
        const sortedDependencies = new Map([...this.dependencies].sort())
        sortedDependencies.forEach((value) => {
            const lines: string[] = []
            lines.push(`## ${value.name}  `)
            lines.push(`License: ${value.license}  `)
            if (value.author) {
                if (typeof value.author === 'object') {
                    lines.push(`Author: ${value.author.name}  `)
                } else {
                    lines.push(`Author: ${value.author.split('<')[0].split('(')[0].trim()}  `)
                }
            }
            if (value.repository && value.repository.url) {
                lines.push(`Repository: ${value.repository.url}  `)
            }
            lines.push('### License Text')
            lines.push(
                value.licenseText
                    .replace(/\n\r|\r/g, '\n')
                    .split('\n')
                    .map((line) => `> ${line}`)
                    .join('\n')
            )

            if (value.noticeText) {
                lines.push('### Notice Text')
                lines.push(
                    value.noticeText
                        .replace(/\n\r|\r/g, '\n')
                        .split('\n')
                        .map((line) => `> ${line}`)
                        .join('\n')
                )
            }
            dependencies.push(lines.join('\n'))
        })
        contents.push(dependencies.join('\n\n---------------------------------------\n\n'))

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
