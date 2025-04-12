import * as vscode from 'vscode'

const outputChannel = vscode.window.createOutputChannel('WebDriverIO')
outputChannel.show(true)

function serializeMessage(msg: unknown) {
    return typeof msg !== 'string' ? JSON.stringify(msg) : msg
}

export const log = {
    debug: (msg: unknown) => {
        outputChannel.appendLine(serializeMessage(msg))
    },
}

export default outputChannel
