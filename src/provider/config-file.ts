import {
    TreeDataProvider, EventEmitter, Event, TreeItem, window, TreeItemCollapsibleState, ThemeIcon,
    Disposable, commands, Command
} from 'vscode';
import * as fs from 'fs/promises';

import { LoggerService } from '../services/logger';
import { plugin } from '../constants';
import { getCurrentWorkspaceFolderUri } from '../utils';

const CONFIG_REGEX = /^wdio\.(.*)\.(ts|js)$/;
const viewId = 'config-explorer';
type ItemTypes = ConfigFileItem | AddNewConfigItem;

export class ConfigFileProvider implements TreeDataProvider<ItemTypes> {
    private _onDidChangeTreeData: EventEmitter<ItemTypes | undefined | null | void> = new EventEmitter<ItemTypes | undefined | null | void>();
    readonly onDidChangeTreeData: Event<ItemTypes | undefined | null | void> = this._onDidChangeTreeData.event;

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
                () => treeDataProvider.refresh()),
            commands.registerCommand(`${plugin}.${viewId}.addConfig`,
                () => treeDataProvider.addConfig())
        );

        return disposables;
    }

    getTreeItem(element: ConfigFileItem): TreeItem {
        return element;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    addConfig(): void {
        window.showInformationMessage('Add Config');
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
        
        const configFiles = rootFiles.filter((d) => (
            d.isFile() && d.name.match(CONFIG_REGEX)
        )).map((d) => new ConfigFileItem(d.name.match(CONFIG_REGEX)![1], d.name));

        /**
         * if no config is in the project, offer to add one
         */
        if (configFiles.length === 0) {
            const newConfigFileEntry = new AddNewConfigItem(
                'Add New Config...',
                {
                    title: 'Add new configuration file...',
                    command: `${plugin}.${viewId}.addConfig`
                }
            );
            return [newConfigFileEntry];
        }

        return configFiles;
    }
}

class ConfigFileItem extends TreeItem {
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

class AddNewConfigItem extends TreeItem {
    constructor(
        public readonly label: string,
        public readonly command: Command
    ) {
        super(label, TreeItemCollapsibleState.None);
        this.command = command;
    }

    iconPath = new ThemeIcon('plus');
}
