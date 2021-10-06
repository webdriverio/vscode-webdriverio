import {
  CancellationToken,
  CustomTextEditorProvider,
  Disposable,
  ExtensionContext,
  TextDocument,
  WebviewPanel,
  window,
  Webview
} from 'vscode';
import { register } from 'ts-node';
import type { Options } from '@wdio/types';

import { LoggerService } from '../services/logger';
import { plugin } from '../constants';


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
        
        // Setup initial content for the webview
        const { webview } = webviewPanel;
        webview.options = { enableScripts: true };
        webviewPanel.onDidDispose(() => this.dispose(), null, this.disposables);
        webviewPanel.webview.html = this._getHtmlForWebview(webview, await this._getDocumentAsJson(document));
    }

    private _getHtmlForWebview(webview: Webview, config?: Options.Testrunner) {
        this.log.debug(config);
        return '<h1>Hello World</h1>';
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
}