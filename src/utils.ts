import { window, workspace } from 'vscode';

export function getCurrentWorkspaceFolderUri() {
    const textEditor = window.activeTextEditor;
    let workspaceFolder;
    if (textEditor) {
        const { document } = textEditor;
        workspaceFolder = workspace.getWorkspaceFolder(document.uri);
    }
    return workspaceFolder?.uri ?? workspace.workspaceFolders?.[0]?.uri;
}
