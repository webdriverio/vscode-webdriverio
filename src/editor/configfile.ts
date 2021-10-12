import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { render, templates, compile } from 'eta';
import {
  CancellationToken,
  CustomTextEditorProvider,
  Disposable,
  ExtensionContext,
  TextDocument,
  WebviewPanel,
  window,
  Webview,
  Uri,
  commands,
} from 'vscode';
import type { Options } from '@wdio/types';

// @ts-ignore
import Runner from 'jscodeshift/src/Runner';

import { WDIO_DEFAULTS } from './constants';
import { LoggerService } from '../services/logger';
import { plugin } from '../constants';
import { ConfigFile } from '../models/configfile';

import type { IndexedValue } from '../types';

const ROOT = path.join(__dirname, '..', '..');
const TPL_ROOT = path.join(ROOT, 'src', 'editor', 'templates');
const TEMPLATE = fs.readFileSync(path.join(TPL_ROOT, 'configfile.tpl.html')).toString();

interface Event {
    type: 'viewInEditor',
    data?: {
        property: keyof Options.Testrunner,
        value: number | number[] | string | string[] | IndexedValue
    }
}

/**
 * load partials
 */
fs.readdirSync(path.join(TPL_ROOT, 'partials'), { withFileTypes: true })
    .filter((file) => file.isFile())
    .forEach((file) => templates.define(
        file.name.replace('.tpl.html', ''),
        compile(fs.readFileSync(path.join(TPL_ROOT, 'partials', file.name)).toString())
    ));

export class ConfigfileEditorProvider implements CustomTextEditorProvider, Disposable {
    private disposables: Disposable[] = [];
    private log: LoggerService = LoggerService.get();
    private _document?: TextDocument;
    private _model?: ConfigFile;
    private _isUpdating = false;

    public static readonly viewType = `${plugin}.configFileEditor`;

    private constructor(private ctx: ExtensionContext) {}

    public static register(ctx: ExtensionContext): Disposable[] {
        const provider = new ConfigfileEditorProvider(ctx);
        const providerRegistration = window.registerCustomEditorProvider(
            ConfigfileEditorProvider.viewType,
            provider
        );
        return [providerRegistration];
    }

    public dispose() {
        this.disposables.forEach((d) => d.dispose());
    }

    public async resolveCustomTextEditor(
        document: TextDocument,
        webviewPanel: WebviewPanel,
        token: CancellationToken
    ): Promise<void> {
        const { webview } = webviewPanel;

        this._document = document;
        this._model = await this._getDocumentAsJson(document);
        webviewPanel.onDidDispose(() => this.dispose(), null, this.disposables);

        if (!this._model || token.isCancellationRequested) {
            commands.executeCommand(
                'vscode.openWith',
                Uri.parse(this._document!.uri.path),
                'default'
            );
            return;
        }

        // Setup initial content for the webview
        this._model.on('update', (config: Options.Testrunner) => this._updateFile(document, config));
        webview.options = { enableScripts: true };
        webview.html = await this._getHtmlForWebview(webview, this._model);
        webview.onDidReceiveMessage(this._onMessage.bind(this));
    }

    private async _getHtmlForWebview(webview: Webview, model: ConfigFile) {
        const config = model.asObject;
        const { cspSource } = webview;
        const nonce = crypto.randomBytes(16).toString('base64');
        const scripts = [{
            src: this._assetUri(webview, ['node_modules', '@bendera', 'vscode-webview-elements', 'dist', 'bundled.js' ]),
            defer: false
        }, {
            src: this._assetUri(webview, ['src', 'editor', 'templates', 'js', 'compat.js']),
        }, {
            src: this._assetUri(webview, ['out', 'editor', 'templates', 'js', 'configfile.js']),
            defer: true
        }];
        const stylesheets = [{
            id: 'vscode-codicon-stylesheet',
            href: this._assetUri(webview, ['node_modules', '@vscode', 'codicons', 'dist', 'codicon.css'])
        }, {
            id: 'vscode-configfile-stylesheet',
            href: this._assetUri(webview, ['src', 'editor', 'templates', 'css', 'configfile.css'])
        }];
        this.log.debug(config);
        try {
            const html = await render(TEMPLATE, {
                config, scripts, stylesheets, nonce, cspSource,
                defaults: WDIO_DEFAULTS
            });
            return html!;
        } catch (err: any) {
            window.showErrorMessage(`Couldn't open WebdriverIO configuration file: ${err.message}`);
            return '';
        }
    }

    private _onMessage(event: Event) {
        this.log.info(`Event: ${event.type}${event.data ? `, with data: ${JSON.stringify(event.data)}` : ''}`);

        if (!this._model) {
            return;
        }

        if (event.type === 'viewInEditor') {
            return commands.executeCommand(
                'vscode.openWith',
                Uri.parse(this._document!.uri.path),
                'default'
            );
        }

        if (event.type === 'update' && event.data) {
            return this._model.update(
                event.data.property,
                event.data.value
            );
        }
    }

    private async _getDocumentAsJson(document: TextDocument) {
        try {
            this.log.debug(`Read config file from ${document.uri.path}`);
            return await ConfigFile.load(document.uri.path);
        } catch (e: any) {
            this.log.error(e.message);
            window.showErrorMessage(`File ${document.fileName} couldn't be parsed`);
        }
    }

    private _assetUri (webview: Webview, pathSegments: string[]) {
        return webview.asWebviewUri(
            Uri.joinPath(this.ctx.extensionUri, ...pathSegments)
        );
    }

    private async _updateFile (document: TextDocument, config: Options.Testrunner) {
        /**
         * if we already run a transform update, don't run again
         */
        if (this._isUpdating) {
            return this.log.info('Config file is currently being updated');
        }

        this._isUpdating = true;
        const result = await Runner.run(
            path.resolve(path.join(__dirname, '..', 'transforms', 'configfile.js')),
            [document.uri.path],
            {
                verbose: 2,
                parser: 'ts',
                config
            }
        );
        this._isUpdating = false;

        if (result.error) {
            window.showErrorMessage('Failed to save updates to config file!');
            return this.log.error(`Couldn't transform config file`);
        }

        this.log.info(`Updated config file within ${result.timeElapsed}s`);
    }
}