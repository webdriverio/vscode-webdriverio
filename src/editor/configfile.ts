import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { render } from 'eta';
import {
  CancellationToken,
  CustomTextEditorProvider,
  Disposable,
  ExtensionContext,
  TextDocument,
  WebviewPanel,
  window,
  Webview,
  Uri
} from 'vscode';
import { register } from 'ts-node';
import type { Options } from '@wdio/types';

import { WDIO_DEFAULTS } from './constants';
import { LoggerService } from '../services/logger';
import { plugin } from '../constants';

const ROOT = path.join(__dirname, '..', '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'src', 'editor', 'templates', 'configfile.tpl.html')).toString();


export class ConfigfileEditorProvider implements CustomTextEditorProvider, Disposable {
    private disposables: Disposable[] = [];
    private log: LoggerService = LoggerService.get();

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

        webviewPanel.onDidDispose(() => this.dispose(), null, this.disposables);
        
        // Setup initial content for the webview
        const { webview } = webviewPanel;
        webview.options = { enableScripts: true };
        webview.html = await this._getHtmlForWebview(webview, await this._getDocumentAsJson(document));
    }

    private async _getHtmlForWebview(webview: Webview, config?: Options.Testrunner) {
        const { cspSource } = webview;
        const nonce = crypto.randomBytes(16).toString('base64');
        const scripts = [
            this._assetUri(webview, ['node_modules', '@bendera', 'vscode-webview-elements', 'dist', 'bundled.js' ])
        ];
        const stylesheets: string[] = [];
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

    private async _getDocumentAsJson(document: TextDocument) {
        try {
            this.log.debug(`Read config file from ${document.uri.path}`);
            if (document.uri.path.endsWith('.ts')) {
                register({ transpileOnly: true });
            }

            const config: Options.Testrunner = await import(document.uri.path);
            return config;
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