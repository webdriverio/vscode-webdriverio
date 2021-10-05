import {
    TreeDataProvider, EventEmitter, Event, TreeItem, window, TreeItemCollapsibleState, ThemeIcon,
    Disposable, commands
} from 'vscode';
import * as fs from 'fs/promises';

import { LoggerService } from '../services/logger';
import { plugin } from '../constants';
import { getCurrentWorkspaceFolderUri } from '../utils';

const CONFIG_REGEX = /^wdio\.(.*)\.(ts|js)$/;
const viewId = 'config-explorer';

export class ConfigFileProvider implements TreeDataProvider<ConfigFile> {
    private _onDidChangeTreeData: EventEmitter<ConfigFile | undefined | null | void> = new EventEmitter<ConfigFile | undefined | null | void>();
    readonly onDidChangeTreeData: Event<ConfigFile | undefined | null | void> = this._onDidChangeTreeData.event;

    private log = LoggerService.get();
    private _workspaceRoot = getCurrentWorkspaceFolderUri();

    private constructor() {
        this.log.info('ConfigFileProvider created');
    }

    static register (): Disposable[] {
        const disposables: Disposable[] = [];
        const treeDataProvider = new ConfigFileProvider();

        disposables.push(
            window.registerTreeDataProvider(`${plugin}.${viewId}`, treeDataProvider),
            window.createTreeView(`${plugin}.${viewId}`, { treeDataProvider }),
            
            // commands
            commands.registerCommand(`${plugin}.${viewId}.refreshEntry`,
                () => treeDataProvider.refresh())
        );

        return disposables;
    }

    getTreeItem(element: ConfigFile): TreeItem {
        return element;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async getChildren() {
        if (!this._workspaceRoot) {
            window.showInformationMessage('No WebdriverIO config in empty workspace');
            return Promise.resolve([]);
        }

        const rootFiles = await fs.readdir(
            this._workspaceRoot.path,
            { withFileTypes: true }
        );
        
        /**
         * ToDo(Christian): allow to create a config if none exist
         */
        return rootFiles.filter((d) => (
            d.isFile() && d.name.match(CONFIG_REGEX)
        )).map((d) => new ConfigFile(d.name.match(CONFIG_REGEX)![1], d.name));
    }
}

class ConfigFile extends TreeItem {
    constructor(
        public readonly label: string,
        private fileName: string
    ) {
        super(label, TreeItemCollapsibleState.None);
        this.tooltip = `${this.label}-${this.fileName}`;
        this.description = this.fileName;
        this.contextValue = 'wdioConfig';
    }

    iconPath = new ThemeIcon('gear');
}
