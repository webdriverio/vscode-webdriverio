import fs from 'fs/promises';
import path from 'path';
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

export async function getWDIOPackage (configPath: string): Promise<any> {
    if (configPath === '//') {
        throw new Error('Couldn\'t find @wdio/cli package');
    }

    const dir = path.dirname(configPath);
    const doesExist = await fs.stat(dir).then(() => true, () => false);

    if (!doesExist) {
        throw new Error(`Couldn't travers file tree, ${dir} not found`);
    }

    const pkgDir = path.join(dir, 'node_modules', '@wdio', 'cli');
    const pkg = await fs.stat(dir).then(
        () => import(pkgDir),
        () => null);

    return pkg.default || getWDIOPackage(dir);
}