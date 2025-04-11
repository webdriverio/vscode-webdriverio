/* eslint-disable no-control-regex */
import * as vscode from 'vscode'
import type { WdioRunResult } from '../utils/wdioRunner.js'

/**
 * WebView provider for displaying test results
 */
export class ResultViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'webdriverio-results'

    private _view?: vscode.WebviewView
    private _latestResults?: WdioRunResult

    constructor(private _extensionUri: vscode.Uri) {}

    /**
     * Update test results and refresh view
     */
    public updateResults(results: WdioRunResult): void {
        this._latestResults = results
        if (this._view) {
            this._updateWebview()
        }
    }

    /**
     * Called when the view is initially created
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void | Thenable<void> {
        this._view = webviewView

        // Allow scripts in the webview
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this._extensionUri, 'media')],
        }

        // Initial render
        this._updateWebview()

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage((message) => {
            switch (message.command) {
                case 'alert':
                    vscode.window.showInformationMessage(message.text)
                    return
            }
        })
    }

    /**
     * Update webview content with latest results
     */
    private _updateWebview(): void {
        if (!this._view) {
            return
        }

        this._view.webview.html = this._getHtmlForWebview()
    }

    /**
     * Generate HTML content for the webview
     */
    private _getHtmlForWebview(): string {
        // If no results available, show initial state
        if (!this._latestResults) {
            return `<!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>WebDriverIO Results</title>
                    <style>
                        body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
                        .message { margin-top: 20px; font-size: 1.2em; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="message">Run tests to see results</div>
                </body>
                </html>`
        }

        // Extract stats
        const stats = this._latestResults.stats || {
            passed: 0,
            failed: 0,
            skipped: 0,
            total: 0,
        }

        // Generate HTML with results
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>WebDriverIO Results</title>
                <style>
                    body { font-family: var(--vscode-font-family); padding: 10px; color: var(--vscode-foreground); }
                    .header { margin-bottom: 20px; }
                    .summary { margin-bottom: 20px; }
                    .stat-box {
                        display: inline-block;
                        padding: 10px;
                        margin-right: 10px;
                        border-radius: 5px;
                        text-align: center;
                        width: 80px;
                    }
                    .passed { background-color: var(--vscode-testing-iconPassed); color: black; }
                    .failed { background-color: var(--vscode-testing-iconFailed); color: white; }
                    .skipped { background-color: var(--vscode-testing-iconSkipped); color: black; }
                    .total { background-color: var(--vscode-editor-background); border: 1px solid var(--vscode-panel-border); }
                    .result {
                        ${this._latestResults.success ? 'color: var(--vscode-testing-iconPassed);' : 'color: var(--vscode-testing-iconFailed);'}
                        font-size: 1.2em;
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    .output {
                        background-color: var(--vscode-terminal-background);
                        color: var(--vscode-terminal-foreground);
                        padding: 10px;
                        border-radius: 5px;
                        font-family: var(--vscode-editor-font-family);
                        white-space: pre-wrap;
                        overflow: auto;
                        max-height: 300px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="result">
                        ${this._latestResults.success ? '✅ Tests Passed' : '❌ Tests Failed'}
                    </div>
                </div>

                <div class="summary">
                    <div class="stat-box passed">
                        <div>${stats.passed}</div>
                        <div>Passed</div>
                    </div>
                    <div class="stat-box failed">
                        <div>${stats.failed}</div>
                        <div>Failed</div>
                    </div>
                    <div class="stat-box skipped">
                        <div>${stats.skipped}</div>
                        <div>Skipped</div>
                    </div>
                    <div class="stat-box total">
                        <div>${stats.total}</div>
                        <div>Total</div>
                    </div>
                </div>

                <div class="output-container">
                    <h3>Output</h3>
                    <div class="output">${this._formatOutput(this._latestResults.output)}</div>
                </div>

                <script>
                    // Auto-scroll to first failure if present
                    document.addEventListener('DOMContentLoaded', () => {
                        const output = document.querySelector('.output');
                        const failure = output.textContent.indexOf('FAILED');
                        if (failure > -1) {
                            // Estimate position and scroll there
                            const lines = output.textContent.substring(0, failure).split('\\n').length;
                            output.scrollTop = lines * 15; // Approximate line height
                        }
                    });
                </script>
            </body>
            </html>`
    }

    /**
     * Format terminal output for HTML display
     */
    private _formatOutput(output: string): string {
        // Escape HTML entities
        let html = output.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

        // Convert ANSI color codes to CSS (simplified)
        html = html
            // Bold
            .replace(/\x1b\[1m(.*?)\x1b\[22m/g, '<strong>$1</strong>')
            // Red (errors)
            .replace(/\x1b\[31m(.*?)(\x1b\[0m|\x1b\[39m)/g, '<span style="color: #ff5555;">$1</span>')
            // Green (success)
            .replace(/\x1b\[32m(.*?)(\x1b\[0m|\x1b\[39m)/g, '<span style="color: #55ff55;">$1</span>')
            // Yellow (warnings)
            .replace(/\x1b\[33m(.*?)(\x1b\[0m|\x1b\[39m)/g, '<span style="color: #ffff55;">$1</span>')
            // Blue
            .replace(/\x1b\[34m(.*?)(\x1b\[0m|\x1b\[39m)/g, '<span style="color: #5555ff;">$1</span>')
            // Reset all other ANSI codes
            .replace(/\x1b\[\d+m/g, '')

        return html
    }
}
