import {
    TreeDataProvider, EventEmitter, Event, TreeItem, window, TreeItemCollapsibleState, ThemeIcon,
    Disposable, commands, Command, Uri
} from 'vscode';
import * as fs from 'fs/promises';
import * as path from 'path';

import { LoggerService } from '../services/logger';
import { plugin } from '../constants';
import { getCurrentWorkspaceFolderUri } from '../utils';

const CONFIG_REGEX = /^wdio\.(.*)\.(ts|js)$/;
type ItemTypes = ConfigFileItem | AddNewConfigItem;

export class ConfigFileProvider implements TreeDataProvider<ItemTypes> {
    static viewId = 'config-explorer';

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
            window.registerTreeDataProvider(
                `${plugin}.${ConfigFileProvider.viewId}`, treeDataProvider),
            window.createTreeView(
                `${plugin}.${ConfigFileProvider.viewId}`, { treeDataProvider }),
            
            // commands
            commands.registerCommand(`${plugin}.${ConfigFileProvider.viewId}.refreshEntry`,
                () => treeDataProvider.refresh()),
            commands.registerCommand(`${plugin}.${ConfigFileProvider.viewId}.addConfig`,
                () => treeDataProvider.addConfig()),
            commands.registerCommand(`${plugin}.${ConfigFileProvider.viewId}.open`,
                (file: ConfigFileItem) => file.open())
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
            d.isFile() && d.name.match(CONFIG_REGEX) && !d.name.endsWith('.d.ts')
        )).map((d) => new ConfigFileItem(d.name.match(CONFIG_REGEX)![1], d.name));

        /**
         * if no config is in the project, offer to add one
         */
        if (configFiles.length === 0) {
            const newConfigFileEntry = new AddNewConfigItem(
                'Add New Config...',
                {
                    title: 'Add new configuration file...',
                    command: `${plugin}.${ConfigFileProvider.viewId}.addConfig`
                }
            );
            return [newConfigFileEntry];
        }

        return configFiles;
    }
}

class ConfigFileItem extends TreeItem {
    private _workspaceRoot = getCurrentWorkspaceFolderUri();
    private _log = LoggerService.get();

    constructor(
        public readonly label: string,
        private fileName: string
    ) {
        super(label, TreeItemCollapsibleState.None);
        this.tooltip = `${this.label}-${this.fileName}`;
        this.description = this.fileName;
        this.contextValue = 'wdioConfig';
        this.command = {
            title: 'Open File',
            command: `${plugin}.${ConfigFileProvider.viewId}.open`,
            arguments: [this]
        };
    }

    open () {
        const filePath = path.join(this._workspaceRoot!.path, this.fileName);
        this._log.info(`Open config file ${filePath}`);
        return commands.executeCommand('vscode.open', Uri.parse(filePath));
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
