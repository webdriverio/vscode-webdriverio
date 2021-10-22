import { Services, Reporters } from '@wdio/types';
import {
    html,
    css,
    LitElement,
    CSSResult,
    property,
    customElement
} from 'lit-element';
import { SUPPORTED_REPORTER, SUPPORTED_SERVICES } from '../constants';
import { ComponentEvent } from '../../types';
import { ServiceEntryStringExpression } from '../../transforms/constants';

const OPTIONS = {
    services: SUPPORTED_SERVICES,
    reporters: SUPPORTED_REPORTER
};

const ICONS = {
    services: 'circuit-board',
    reporters: 'checklist'
};

const PLUGIN_ATTRIBUTE = 'data-plugin';

@customElement('wdio-plugin')
export class WdioPlugin extends LitElement {
    @property({ type: Object, reflect: true })
    value: (Services.ServiceEntry | Reporters.ReporterEntry)[] = [];

    @property({ type: String, reflect: true })
    type: 'services' | 'reporters' = 'services';

    static get styles(): CSSResult {
        return css/*css*/`
        label {
            display: block;
            margin-bottom: 5px;
        }
        .wrapper {
            margin-bottom: 10px;
        }
        `;
    }

    render() {
        if (this.value.length === 0) {
            return this.addPluginBtn;
        }

        const tree = document.createElement('vscode-tree');
        tree.addEventListener('vsc-select', this.enableRemoveBtn.bind(this) as any);
        tree.data = this.value.map((p) => {
            let [label] = (Array.isArray(p) ? p : [p, {}]) as any as [string, any];
            return { icons: { leaf: this.icon }, label };
        });

        /**
         * if we have objects in the service list, e.g.:
         * ```
         * services: [
         *     'devtools',
         *     { ... },
         *     { ... },
         *     ...
         * ]
         * ```
         * we won't be able to differentiate between these. In these
         * cases we can't allow to remove elements as we can't recreate
         * the service list
         */
        const hasUnindentifiableEntries = this.value.includes(ServiceEntryStringExpression);
        
        return html/* html */`
        <div class="wrapper">${tree}</div>
        <hr />
        ${this.addPluginBtn}
        ${!hasUnindentifiableEntries ? html/*html*/`
            <vscode-button
                @click="${this.removePlugin}"
                class="removeBtn"
                disabled
            >Remove</vscode-button>
        ` : ''}`;
    }

    addNewPlugin (ev: ComponentEvent) {
        ev.stopPropagation();
        const oldVal = this.valueCopy;
        const value = this.shadowRoot?.querySelector('vscode-single-select')?.value as string;
        this.value.push(value);
        this.requestUpdate('value', oldVal);
        this.dispatchUpdate();
    }

    removePlugin (ev: ComponentEvent) {
        ev.stopPropagation();
        const btn = ev.path.find((el) => (
            (el as HTMLElement).tagName &&
            (el as HTMLElement).tagName.toLowerCase() === 'vscode-button'
        )) as HTMLElement;
        const oldVal = this.valueCopy;
        const pluginToDelete = btn.getAttribute(PLUGIN_ATTRIBUTE);
        this.value = this.value.filter((p) => !(
            p === pluginToDelete ||
            (p as [string, Services.ServiceOption])[0] === pluginToDelete
        ));
        btn.setAttribute('disabled', 'disabled');
        btn.removeAttribute(PLUGIN_ATTRIBUTE);
        this.requestUpdate('value', oldVal);
        this.dispatchUpdate();
    }

    dispatchUpdate () {
        this.dispatchEvent(
            new CustomEvent('vsc-change', { detail: this.value })
        );
    }

    enableRemoveBtn (ev: ComponentEvent) {
        const removeBtn = this.shadowRoot?.querySelector('.removeBtn');
        if (!removeBtn) {
            return;
        }

        removeBtn.setAttribute(PLUGIN_ATTRIBUTE, ev.detail.value);
        removeBtn.removeAttribute('disabled');
    }

    get addPluginBtn () {
        const newPlugins = this.options.filter((o) => !this.value.includes(o.value));
        
        return html/*html*/`
        <label>Add new ${this.label}</label>
        <vscode-single-select>
            ${newPlugins.map((o) => html/*html*/`
            <vscode-option
                description=${o.label}
                value=${o.value}
            >
                ${o.value}
            </vscode-option>
            `)}
        </vscode-single-select>
        <vscode-button @click="${this.addNewPlugin}">Add</vscode-button>
        `;
    }

    get options () {
        return OPTIONS[this.type];
    }

    get icon () {
        return ICONS[this.type];
    }

    get label () {
        return this.type.slice(0, 1).toUpperCase() + this.type.slice(1);
    }

    get valueCopy () {
        return JSON.parse(JSON.stringify(this.value));
    }
}