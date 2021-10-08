/** @type {import("vscode-webview").WebviewApi<{}>} */
const vscode = acquireVsCodeApi();

const viewInEditorBtn = document.querySelector('#btnEditor');
viewInEditorBtn.onclick = function () {
    vscode.postMessage({ type: 'viewInEditor' });
};

// handle form fields
const formFields = [
    ...document.getElementsByTagName('vscode-inputbox'),
    ...document.getElementsByTagName('vscode-multi-select'),
    ...document.getElementsByTagName('vscode-single-select')
];
for (const input of formFields) {
    input.addEventListener('vsc-change', (event) => {
        const property = event.srcElement.getAttribute('name');
        
        let value = event.detail;
        if (typeof event.detail === 'object') {
            if (event.detail.hasOwnProperty('selectedIndex')) {
                value = event.detail.selectedIndex;
            } else if (event.detail.hasOwnProperty('selectedIndexes')) {
                value = event.detail.selectedIndexes;
            }
        } else if (event.srcElement.getAttribute('type') === 'number') {
            value = parseInt(value, 10);
            if (isNaN(value)) {
                value = undefined;
            }
        } else if (event.srcElement.hasAttribute('multiline')) {
            value = value.split('\n').filter((l) => l.length > 0);
        } else if (event.srcElement.hasAttribute('data-index')) {
            value = {
                index: parseInt(input.getAttribute('data-index')),
                value: value.includes('\n') ? value.split('\n') : value
            };
        }
        vscode.postMessage({
            type: 'update',
            data: { property, value }
        });
    });
}