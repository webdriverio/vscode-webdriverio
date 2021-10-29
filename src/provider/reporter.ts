import {
    TreeDataProvider, EventEmitter, Event, TreeItem, window, TreeItemCollapsibleState, ThemeIcon,
    Disposable
} from 'vscode';
import * as path from 'path';
import ipc from 'node-ipc';
import type { RunnerStats, TestStats, BeforeCommandArgs, AfterCommandArgs, CommandArgs } from '@wdio/reporter';

import { InfoEntry } from './utils';
import { LoggerService } from '../services/logger';
import { plugin } from '../constants';

type ItemTypes = SessionLogs | TestItem | InfoEntry | CommandItem;

ipc.config.id = 'vscodeWebdriverIO';
ipc.config.retry = 1500;
ipc.config.logger = () => {};

export class ReporterProvider implements TreeDataProvider<ItemTypes> {
    static viewId = 'testrun-explorer';

    private _currentTestByWorker: Map<string, string> = new Map();
    private _workers: Map<string, RunnerStats> = new Map();
    private _tests: Map<string, TestStats> = new Map();
    private _commands: Map<string, CommandArgs[]> = new Map();
    private _specs: Map<string, string[]> = new Map();
    private _onDidChangeTreeData: EventEmitter<ItemTypes | undefined | null | void> = new EventEmitter<ItemTypes | undefined | null | void>();
    readonly onDidChangeTreeData: Event<ItemTypes | undefined | null | void> = this._onDidChangeTreeData.event;

    private log = LoggerService.get();

    private constructor() {
        this.log.info('ReporterProvider created');
        ipc.serve(this._onConnect.bind(this));
        ipc.server.start();
    }

    private _onConnect () {
        ipc.server.on('start', this._reset.bind(this));
        ipc.server.on('onRunnerStart', this._onRunnerStart.bind(this));
        ipc.server.on('onRunnerEnd', this._onRunnerEnd.bind(this));
        ipc.server.on('onTestStart', this._onTestStart.bind(this));
        ipc.server.on('onTestEnd', this._onTestEnd.bind(this));
        ipc.server.on('onBeforeCommand', this._onCommandStart.bind(this));
        ipc.server.on('onAfterCommand', this._onCommandEnd.bind(this));
    }

    private _reset () {
        this._currentTestByWorker = new Map();
        this._workers = new Map();
        this._tests = new Map();
        this._commands = new Map();
        this._specs = new Map();
        this.refresh();
    }

    private _onRunnerStart (stats: RunnerStats) {
        this._workers.set(stats.cid, stats);
        this.refresh();
    }

    private _onRunnerEnd (stats: RunnerStats) {
        this._workers.set(stats.cid, stats);
        this.refresh();
    }

    private _onTestStart (stats: TestStats) {
        const tests = this._specs.get(stats.cid) || [];
        tests.push(stats.uid);
        this._currentTestByWorker.set(stats.cid, stats.uid);
        this._tests.set(stats.uid, stats);
        this._specs.set(stats.cid, tests);
        this.refresh();
    }

    private _onTestEnd (stats: TestStats) {
        this._tests.set(stats.uid, stats);
        this.refresh();
    }

    private _onCommandStart (args: BeforeCommandArgs) {
        const testId = this._currentTestByWorker.get(args.cid);
        if (!testId) {
            return this.log.info(`No current test defined for ${args.cid}`);
        }
        const commands = this._commands.get(testId) || [];
        commands.push(args as CommandArgs);
        this._commands.set(testId, commands);
        this.refresh();
    }

    private _onCommandEnd (args: AfterCommandArgs) {
        const testId = this._currentTestByWorker.get(args.cid);
        if (!testId) {
            return this.log.info(`No current test defined for ${args.cid}`);
        }
        const commands = this._commands.get(testId) || [];
        const lastCommand = commands.pop();

        if (!lastCommand) {
            return this.log.info(`No commands found for ${testId}`);
        }

        commands.push({ ...lastCommand, ...args } as CommandArgs);
        this._commands.set(testId, commands);
        this.refresh();
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
        if (element) {
            if (element instanceof SessionLogs) {
                const tests = this._specs.get(element.stats.cid);
                if (!tests || tests.length === 0) {
                    return [new InfoEntry('...')];
                }

                return tests
                    .filter((uid) => this._tests.get(uid))
                    .map((uid) => {
                        const stats = this._tests.get(uid)!;
                        const commands = this._commands.get(uid) || [];
                        const collapsibleState = stats.state === 'pending'
                            ? TreeItemCollapsibleState.Expanded
                            : commands.length
                                ? TreeItemCollapsibleState.Collapsed
                                : TreeItemCollapsibleState.None;
                        return new TestItem(stats, collapsibleState);
                    });
            }

            if (element instanceof TestItem) {
                const commands = this._commands.get(element.stats.uid);
                if (!commands || commands.length === 0) {
                    return [new InfoEntry('No commands run')];
                }

                return commands.map((command) => new CommandItem(command));
            }

            this.log.error(`Unknown child ${element}`);
            return [];
        }

        if (this._workers.size === 0) {
            return [new InfoEntry('No testrun started')];
        }

        return [...this._workers.entries()]
            .map(([cid, stats]) => new SessionLogs(
                cid,
                stats,
                this._specs.get(stats.cid)?.length! > 0
                    ? TreeItemCollapsibleState.Expanded
                    : TreeItemCollapsibleState.Collapsed
            ));
    }
}

export class SessionLogs extends TreeItem {
    constructor(
        public cid: string,
        public stats: RunnerStats,
        public collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.Collapsed
    ) {
        super(
            `Worker: ${cid} - ` + (
                Array.isArray(stats.specs)
                    ? `running ${stats.specs.length} specs`
                    : `running ${path.basename(stats.specs)}`
            ),
            collapsibleState
        );
        this.iconPath = new ThemeIcon(stats.end ? 'terminal-view-icon' : 'sync~spin');
    }
}

export class TestItem extends TreeItem {
    constructor(
        public stats: TestStats, 
        public collapsibleState: TreeItemCollapsibleState
    ) {
        super(stats.fullTitle, collapsibleState);
        this.iconPath = new ThemeIcon(stats.state === 'pending'
            ? 'sync~spin'
            : stats.state === 'failed' ? 'testing-failed-icon' : 'testing-passed-icon'
        );
        if (stats._duration) {
            this.description = `(${stats._duration}ms)`;
        }
    }
}

export class CommandItem extends TreeItem {
    public iconPath = new ThemeIcon('debug-step-over');
    constructor(public commandArgs: CommandArgs) {
        super(commandArgs.command!, TreeItemCollapsibleState.None);
        const params = Object.entries(commandArgs.params)
            .map(([prop, val]) => `${prop}: ${val}`)
            .join(', ');
        this.description = `(${params})`;
    }
}