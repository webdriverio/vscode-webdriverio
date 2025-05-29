import { normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import type * as vscode from 'vscode'

export function normalizePath(p: string) {
    const _specPath = p.startsWith('file://') ? fileURLToPath(p) : p
    return normalize(normalizeDriveLetter(_specPath))
}

export function convertUriToPath(uri: vscode.Uri) {
    return normalizeDriveLetter(uri.fsPath)
}

function normalizeDriveLetter(p: string) {
    // the windows drive letter of vscode.Uri.fsPath is always lowercase. but the node environment is Uppercase.
    // So, convert to uppercase to adjust node one only windows environment.
    return process.platform === 'win32' ? p.replace(/^([a-z]):/, (match, p1) => `${p1.toUpperCase()}:`) : p
}
