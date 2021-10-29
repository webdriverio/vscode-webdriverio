import {
    TreeDataProvider, EventEmitter, Event, TreeItem, window, TreeItemCollapsibleState, ThemeIcon,
    Disposable
} from 'vscode';
import * as path from 'path';

import { InfoEntry } from './utils';
import { LoggerService } from '../services/logger';
import { plugin } from '../constants';

type ItemTypes = SessionLogs | TestItem | InfoEntry;

export class ReporterProvider implements TreeDataProvider<ItemTypes> {
    static viewId = 'testrun-explorer';

    private _workers: Map<string, any> = new Map();
    private _onDidChangeTreeData: EventEmitter<ItemTypes | undefined | null | void> = new EventEmitter<ItemTypes | undefined | null | void>();
    readonly onDidChangeTreeData: Event<ItemTypes | undefined | null | void> = this._onDidChangeTreeData.event;

    private log = LoggerService.get();

    private constructor() {
        this.log.info('ReporterProvider created');
    }

    static register (): Disposable[] {
        const disposables: Disposable[] = [];
        const treeDataProvider = new ReporterProvider();

        disposables.push(
            window.registerTreeDataProvider(
                `${plugin}.${ReporterProvider.viewId}`, treeDataProvider),
            window.createTreeView(
                `${plugin}.${ReporterProvider.viewId}`, { treeDataProvider })
        );

        return disposables;
    }

    getTreeItem(element: ItemTypes): TreeItem {
        return element;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getChildren(element?: ItemTypes) {
        console.log('#GET ME');
        
        if (element) {
            return [new TestItem('Given this I should do that')];
        }

        if (this._workers.size === 0) {
            return [new InfoEntry('No testrun started')];
        }

        return [...this._workers.entries()]
            .map(([cid, worker]) => new SessionLogs(cid, worker.specs));
    }
}

export class SessionLogs extends TreeItem {
    public iconPath = new ThemeIcon('sync~spin');
    constructor(cid: string, spec: string | string[]) {
        super(
            `Worker: ${cid} - ` + (
                Array.isArray(spec)
                    ? `running ${spec.length} specs`
                    : `running ${path.basename(spec)}`
            ),
            TreeItemCollapsibleState.Expanded
        );
    }
}

export class TestItem extends TreeItem {
    public iconPath = new ThemeIcon('check');
    constructor(public label: string) {
        super(label, TreeItemCollapsibleState.Expanded);
    }
}
