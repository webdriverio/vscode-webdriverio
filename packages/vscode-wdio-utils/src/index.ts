export * from './normalize.js'
export * from './watcher.js'

import type * as vscode from 'vscode'

export function convertUriToPath(uri: vscode.Uri) {
    // the windows drive letter of vscode.Uri.fsPath is always lowercase. but the node environment is Uppercase.
    // So, convert to uppercase to adjust node one only windows environment.
    return process.platform === 'win32'
        ? uri.fsPath.replace(/^([a-z]):/, (match, p1) => `${p1.toUpperCase()}:`)
        : uri.fsPath
}
