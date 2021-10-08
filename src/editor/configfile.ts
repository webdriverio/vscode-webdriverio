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
  commands
} from 'vscode';
import { register } from 'ts-node';
import type { Options } from '@wdio/types';

import { WDIO_DEFAULTS } from './constants';
import { LoggerService } from '../services/logger';
import { plugin } from '../constants';
import { ConfigFile } from '../models/configfile';

const ROOT = path.join(__dirname, '..', '..');
const TPL_ROOT = path.join(ROOT, 'src', 'editor', 'templates');
const TEMPLATE = fs.readFileSync(path.join(TPL_ROOT, 'configfile.tpl.html')).toString();

interface Event {
    type: 'viewInEditor',
    data?: {
        property: keyof Options.Testrunner,
        value: number | number[] | string | string[]
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
        if (token.isCancellationRequested) {
            return;
        }

        this._document = document;
        this._model = await this._getDocumentAsJson(document);

        webviewPanel.onDidDispose(() => this.dispose(), null, this.disposables);
        
        // Setup initial content for the webview
        const { webview } = webviewPanel;
        webview.options = { enableScripts: true };
        webview.html = await this._getHtmlForWebview(webview, this._model);
        webview.onDidReceiveMessage(this._onMessage.bind(this));
    }

    private async _getHtmlForWebview(webview: Webview, model?: ConfigFile) {
        const config = model?.asObject;
        const { cspSource } = webview;
        const nonce = crypto.randomBytes(16).toString('base64');
        const scripts = [{
            src: this._assetUri(webview, ['node_modules', '@bendera', 'vscode-webview-elements', 'dist', 'bundled.js' ]),
            defer: false
        }, {
            src: this._assetUri(webview, ['src', 'editor', 'templates', 'js', 'configfile.js']),
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

        if (event.type === 'viewInEditor') {
            return commands.executeCommand(
                'vscode.openWith',
                Uri.parse(this._document!.uri.path),
                'default'
            );
        }
        if (event.type === 'update') {
            return this._model?.update(
                event.data!.property,
                event.data!.value
            );
        }
    }

    private async _getDocumentAsJson(document: TextDocument) {
        try {
            this.log.debug(`Read config file from ${document.uri.path}`);
            if (document.uri.path.endsWith('.ts')) {
                register({ transpileOnly: true });
            }

            const { config }: { config: Options.Testrunner } = await import(document.uri.path);
            return new ConfigFile(config);
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
}