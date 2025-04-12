import * as vscode from 'vscode'

const outputChannel = vscode.window.createOutputChannel('WebDriverIO')
outputChannel.show(true)

function serializeMessage(msg: unknown) {
    return typeof msg !== 'string' ? JSON.stringify(msg) : msg
}
const print = (msg: unknown) => {
    outputChannel.appendLine(serializeMessage(msg))
}

export const log = {
    trace: print,
    info: print,
    warn: print,
    error: print,
    debug: print,
}

export default outputChannel
