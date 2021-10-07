/** @type {import("vscode-webview").WebviewApi<{}>} */
const vscode = acquireVsCodeApi();

const viewInEditorBtn = document.querySelector('#btnEditor');

viewInEditorBtn.onclick = function () {
    vscode.postMessage({
        type: 'command',
        args: {

        }
    });
};