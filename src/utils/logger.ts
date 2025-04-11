import * as vscode from 'vscode'

const outputChannel = vscode.window.createOutputChannel('WebDriverIO Runner')
outputChannel.show(true)

export default outputChannel
