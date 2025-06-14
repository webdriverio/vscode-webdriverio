import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { parse, print, visit, types as t } from 'recast'
// @ts-ignore
import typescriptParser from 'recast/parsers/typescript'

const reporterIdentifierName = 'VscodeJsonReporter'

// This file is bundle as parser/ats.js at the package of vscode-webdriverio
// So, the correct reporter path is parent directory
const VSCODE_REPORTER_PATH = path.resolve(__dirname, '../reporter.cjs')

/**
 * Create AST nodes using ast-types builders
 */
const b = t.builders

/**
 * Since Windows cannot import by reporter file path due to issues with
 * the `initializePlugin` method of wdio-utils, the policy is to create a temporary configuration file.
 */
export async function createTempConfigFile(filename: string, outDir: string) {
    const source = await fs.readFile(filename, { encoding: 'utf8' })
    const ast = parse(source, {
        parser: typescriptParser,
    })

    const reporterIdentifier = b.identifier(reporterIdentifierName)
    const reporterConfigIdentifier = b.identifier(`${reporterIdentifierName}.default || ${reporterIdentifierName}`)
    const reporterElement = b.arrayExpression([
        reporterConfigIdentifier,
        b.objectExpression([
            b.property('init', b.identifier('stdout'), b.literal(true)),
            b.property('init', b.identifier('outputDir'), b.literal(outDir)),
        ]),
    ])
    let hasReporterImport = false

    function addOrUpdateReporters(configObject: any) {
        if (!t.namedTypes.ObjectExpression.check(configObject)) {
            return
        }

        // Find existing reporters property
        let reportersProp = null

        for (let i = 0; i < configObject.properties.length; i++) {
            const prop = configObject.properties[i]

            // Check for both Property and ObjectProperty nodes
            if (t.namedTypes.Property.check(prop) || t.namedTypes.ObjectProperty?.check?.(prop)) {
                const isReportersKey =
                    (t.namedTypes.Identifier.check(prop.key) && prop.key.name === 'reporters') ||
                    (t.namedTypes.Literal.check(prop.key) && prop.key.value === 'reporters')

                if (isReportersKey) {
                    reportersProp = prop
                    break
                }
            }
        }

        if (reportersProp && t.namedTypes.ArrayExpression.check(reportersProp.value)) {
            // Add to existing reporters array
            reportersProp.value.elements.push(reporterElement)
        } else if (reportersProp) {
            // Replace existing non-array reporters with array including existing value
            const existingValue = reportersProp.value
            //@ts-ignore
            reportersProp.value = b.arrayExpression([existingValue, reporterElement])
        } else {
            // Add new reporters property
            configObject.properties.push(
                b.property('init', b.identifier('reporters'), b.arrayExpression([reporterElement]))
            )
        }
    }

    visit(ast, {
        visitImportDeclaration(path) {
            const { source, specifiers } = path.node
            if (
                source.value === pathToFileURL(VSCODE_REPORTER_PATH).href &&
                specifiers &&
                //@ts-ignore
                specifiers.some(
                    //@ts-ignore
                    (s: any) => t.namedTypes.ImportDefaultSpecifier.check(s) && s.local.name === reporterIdentifierName
                )
            ) {
                hasReporterImport = true
            }
            this.traverse(path)
        },

        visitExportNamedDeclaration(path) {
            const decl = path.node.declaration

            if (t.namedTypes.VariableDeclaration.check(decl)) {
                const first = decl.declarations[0]

                if (t.namedTypes.VariableDeclarator.check(first)) {
                    const id = first.id
                    const init = first.init

                    if (t.namedTypes.Identifier.check(id) && id.name === 'config') {
                        if (t.namedTypes.ObjectExpression.check(init)) {
                            addOrUpdateReporters(init)
                        } else if (
                            t.namedTypes.CallExpression.check(init) &&
                            init.arguments.length > 0 &&
                            t.namedTypes.ObjectExpression.check(init.arguments[0])
                        ) {
                            const configObject = init.arguments[0]
                            addOrUpdateReporters(configObject)
                        }
                    }
                }
            }

            this.traverse(path)
        },

        visitAssignmentExpression(path) {
            const { left, right } = path.node
            if (!left || !right) {
                this.traverse(path)
                return
            }

            if (
                t.namedTypes.MemberExpression.check(left) &&
                t.namedTypes.Identifier.check(left.object) &&
                t.namedTypes.Identifier.check(left.property) &&
                t.namedTypes.ObjectExpression.check(right)
            ) {
                const leftName = `${left.object.name}.${left.property.name}`
                if (['module.exports', 'exports.config'].includes(leftName)) {
                    addOrUpdateReporters(right)
                }
            }

            this.traverse(path)
        },

        visitCallExpression(path) {
            const node = path.node

            if (
                t.namedTypes.CallExpression.check(node) &&
                t.namedTypes.Identifier.check(node.callee) &&
                node.callee.name === 'require' &&
                node.arguments.length === 1 &&
                t.namedTypes.Literal.check(node.arguments[0]) &&
                typeof node.arguments[0].value === 'string' &&
                node.arguments[0].value === pathToFileURL(VSCODE_REPORTER_PATH).href
            ) {
                hasReporterImport = true
            }

            this.traverse(path)
        },
    })

    if (!hasReporterImport) {
        const importedModule = b.importDeclaration(
            [b.importDefaultSpecifier(reporterIdentifier)],
            b.literal(pathToFileURL(VSCODE_REPORTER_PATH).href)
        )

        ast.program.body.unshift(importedModule)
    }

    const output = print(ast).code
    const ext = path.extname(filename)
    const _filename = path.join(path.dirname(filename), `wdio-vscode-${new Date().getTime()}${ext}`)
    await fs.writeFile(_filename, output)
    return _filename
}

export function isWindows() {
    return process.platform === 'win32'
}
