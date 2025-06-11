import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import * as parser from '@babel/parser'
import * as t from '@babel/types'
import recast from 'recast'

const reporterIdentifierName = 'VscodeJsonReporter'
const VSCODE_REPORTER_PATH = path.resolve(__dirname, 'reporter.cjs')
/**
 * Since Windows cannot import by reporter file path due to issues with
 * the `initializePlugin` method of wdio-utils, the policy is to create a temporary configuration file.
 */
export async function createTempConfigFile(filename: string, outDir: string) {
    const source = await fs.readFile(filename, { encoding: 'utf8' })
    const ast = recast.parse(source, {
        parser: {
            parse(source: string) {
                return parser.parse(source, {
                    sourceType: 'unambiguous',
                    plugins: ['typescript', 'jsx', 'topLevelAwait'],
                })
            },
        },
    })

    const reporterIdentifier = t.identifier(reporterIdentifierName)
    const reporterConfigIdentifier = t.identifier(`${reporterIdentifierName}.default || ${reporterIdentifierName}`)
    const reporterElement = t.arrayExpression([
        reporterConfigIdentifier,
        t.objectExpression([
            t.objectProperty(t.identifier('stdout'), t.booleanLiteral(true)),
            t.objectProperty(t.identifier('outputDir'), t.stringLiteral(outDir)),
        ]),
    ])
    let hasReporterImport = false

    function addOrUpdateReporters(configObject: t.Node) {
        if (!t.isObjectExpression(configObject)) {
            return
        }

        const reportersProp = configObject.properties.find(
            (prop) =>
                t.isObjectProperty(prop) &&
                ((t.isIdentifier(prop.key) && prop.key.name === 'reporters') ||
                    (t.isStringLiteral(prop.key) && prop.key.value === 'reporters'))
        )

        if (reportersProp && t.isObjectProperty(reportersProp) && t.isArrayExpression(reportersProp.value)) {
            reportersProp.value.elements.push(reporterElement)
        } else {
            configObject.properties.push(
                t.objectProperty(t.identifier('reporters'), t.arrayExpression([reporterElement]))
            )
        }
    }

    recast.types.visit(ast, {
        visitImportDeclaration(path) {
            const { source, specifiers } = path.node
            if (
                source.value === pathToFileURL(VSCODE_REPORTER_PATH).href &&
                specifiers &&
                //@ts-ignore
                specifiers.some((s) => t.isImportDefaultSpecifier(s) && s.local.name === reporterIdentifierName)
            ) {
                hasReporterImport = true
            }
            this.traverse(path)
        },

        visitExportNamedDeclaration(path) {
            const decl = path.node.declaration

            // @ts-ignore
            if (t.isVariableDeclaration(decl)) {
                const first = decl.declarations[0]

                if (t.isVariableDeclarator(first)) {
                    const id = first.id
                    const init = first.init

                    if (t.isIdentifier(id) && id.name === 'config') {
                        if (t.isObjectExpression(init)) {
                            addOrUpdateReporters(init)
                        } else if (
                            t.isCallExpression(init) &&
                            init.arguments.length > 0 &&
                            t.isObjectExpression(init.arguments[0])
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
                // @ts-ignore
                t.isMemberExpression(left) &&
                t.isIdentifier(left.object) &&
                t.isIdentifier(left.property) &&
                // @ts-ignore
                t.isObjectExpression(right)
            ) {
                const leftName = `${left.object.name}.${left.property.name}`
                if (['module.exports', 'exports.config'].includes(leftName)) {
                    addOrUpdateReporters(right)
                }
            }

            this.traverse(path)
        },

        visitCallExpression(path) {
            const node = path.node as t.Node

            if (
                t.isCallExpression(node) &&
                t.isIdentifier(node.callee, { name: 'require' }) &&
                node.arguments.length === 1 &&
                t.isStringLiteral(node.arguments[0]) &&
                node.arguments[0].value === pathToFileURL(VSCODE_REPORTER_PATH).href
            ) {
                hasReporterImport = true
            }

            this.traverse(path)
        },
    })

    if (!hasReporterImport) {
        const importedModule = t.importDeclaration(
            [t.importDefaultSpecifier(reporterIdentifier)],
            t.stringLiteral(pathToFileURL(VSCODE_REPORTER_PATH).href)
        )

        ast.program.body.unshift(importedModule)
    }

    const output = recast.print(ast).code
    const ext = path.extname(filename)
    const _filename = path.join(path.dirname(filename), `wdio-vscode-${new Date().getTime()}${ext}`)
    await fs.writeFile(_filename, output)
    return _filename
}

export function isWindows() {
    return process.platform === 'win32'
}
