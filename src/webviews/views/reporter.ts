import {
    html,
    css,
    LitElement,
    CSSResult,
    customElement
} from 'lit-element';

@customElement('wdio-reporter-webview')
export class WdioReporterWebview extends LitElement {
    static get styles(): CSSResult {
        return css/*css*/`
        div {
            color: blue;
        }
        `;
    }

    render () {
        return html/*html*/`
            <i>No testrunner started.</i>
        `;
    }
}