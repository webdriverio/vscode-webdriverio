import { TreeItem, TreeItemCollapsibleState } from 'vscode';

export class InfoEntry extends TreeItem {
    constructor(public readonly label: string) {
        super(label, TreeItemCollapsibleState.None);
    }
}