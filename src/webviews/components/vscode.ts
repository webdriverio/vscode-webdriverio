import type { WebviewApi } from 'vscode-webview';

let vscode: WebviewApi<any>;

export const acquireVsCodeApi = <T>() => {
    if (vscode) {
        return vscode as WebviewApi<T>;
    }

    const api = window.acquireVsCodeApi<T>();
    vscode = api;
    return api;
};