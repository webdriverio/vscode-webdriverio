import type { LitElement } from 'lit-element';
import type { VscodeInputbox, VscodeMultiSelect, VscodeSingleSelect } from '@bendera/vscode-webview-elements';
import type { VscChangeEvent, IndexedValue } from '../../../types';
import { Options } from '@wdio/types';

// @ts-expect-error
const vscode = acquireVsCodeApi();
const initialJson: Record<string, any> = {};

/**
 * capture all form fields
 */
const formFields = [
    ...document.getElementsByTagName('vscode-inputbox'),
    ...document.getElementsByTagName('vscode-multi-select'),
    ...document.getElementsByTagName('vscode-single-select')
];

/**
 * "View in Editor" command listener
 */
const viewInEditorBtn: HTMLElement | null = document.getElementById('btnEditor');
if (viewInEditorBtn) {
    viewInEditorBtn.onclick = () => vscode.postMessage({ type: 'viewInEditor' });
}

/**
 * "New Site" command listener
 */
const newSuiteBtn: HTMLElement | null = document.getElementById('newSuite');
const suiteTableBody: HTMLElement | null = document.querySelector('.suitesTable > vscode-table-body');
if (newSuiteBtn && suiteTableBody) {
    newSuiteBtn.onclick = () => {
        const newIndex = document.querySelectorAll('*[name^="suiteName"]').length;
        const row = document.createElement('vscode-table-row');
        row.setAttribute('role', 'row');
        row.innerHTML = `
            <vscode-table-cell role="cell">
                <vscode-inputbox name="suiteName[${newIndex}]" data-index="${newIndex}"></vscode-inputbox>
            </vscode-table-cell>
            <vscode-table-cell role="cell">
                <vscode-inputbox name="suiteSpecs[${newIndex}]" multiline="" data-index="${newIndex}"></vscode-inputbox>
            </vscode-table-cell>`;
        suiteTableBody!.innerHTML += row.outerHTML;
        const state = vscode.getState();
        state.suites[''] = [];
        vscode.setState(state);
        reininitiateState();
        registerListener([...suiteTableBody.querySelectorAll('vscode-inputbox')]);
    };
}

const getInputValue = (elem: LitElement) => {
    const property = elem.getAttribute('name');

    if (!property) {
        throw new Error(`Element ${elem} has no name and can't be identified`);
    }

    const singleSelect = elem as VscodeSingleSelect;
    const multiSelect = elem as VscodeMultiSelect;
    const inputBox = elem as VscodeInputbox;

    let value: string | string[] | number | number[] | IndexedValue | undefined;
    if (typeof singleSelect.selectedIndex !== 'undefined') {
        value = singleSelect.selectedIndex;
    } else if (typeof multiSelect.selectedIndexes !== 'undefined') {
        value = multiSelect.selectedIndexes;
    } else if (elem.getAttribute('type') === 'number') {
        value = parseInt(inputBox.value, 10);
        if (isNaN(value)) {
            value = undefined;
        }
    } else if (elem.hasAttribute('data-index')) {
        const val = inputBox.value;
        value = {
            index: parseInt(elem.getAttribute('data-index') || ''),
            value: val.includes('\n') ? val.split('\n') : (val || '')
        } as IndexedValue;
    } else if (elem.hasAttribute('multiline')) {
        value = inputBox.value.split('\n').filter((l) => l.length > 0);
    } else if (typeof inputBox.value !== 'undefined') {
        value = inputBox.value;
    }

    if (value === null) {
        throw new Error(`Couldn't get value for element ${elem}`);
    }

    console.log('YOO', elem, property, value);
    return { property, value };
};

const setInputValue = (elem: LitElement, value: any) => {
    console.log(`Set value`, elem, value);
    const singleSelect = elem as VscodeSingleSelect;
    const multiSelect = elem as VscodeMultiSelect;
    const inputBox = elem as VscodeInputbox;
    
    if (typeof singleSelect.selectedIndex !== 'undefined') {
        singleSelect.selectedIndex = value;
    } else if (typeof multiSelect.selectedIndexes !== 'undefined') {
        multiSelect.selectedIndexes = value;
    } else if (elem.hasAttribute('multiline') && Array.isArray(value)) {
        inputBox.value = value.join('\n');
    } else if (typeof value.index === 'number') {
        elem.setAttribute('data-index', value.index);
        inputBox.value = value.value;
    } else {
        inputBox.value = value;
    }
};

/**
 * Input listener to propagate changed data outside
 * @param {VscChangeEvent} event 
 */
const onChangeListener = (event: VscChangeEvent) => {
    const state: Options.Testrunner = vscode.getState();
    const { property, value } = getInputValue(event.srcElement);
    let newProperty = property;
    let newValue: any = value;

    const isSuiteProp = property.startsWith('suiteName');
    const isSuiteVal = property.startsWith('suiteSpecs');
    if ((isSuiteProp || isSuiteVal)) {
        console.log('START WITH STATE', state);
        let suites = state.suites || {};

        /**
         * update single object values/properties, e.g. suite name or specs
         * of a specific suite, e.g. update "suiteName[2]" or "suiteSpecs[1]"
         * using the actual object
         */
        const newVal = value as IndexedValue;
        const entries = Object.entries(suites);

        /**
         * check if new item was added
         */
        console.info(newVal, entries);
        if (newVal.index > (entries.length - 1)) {
            console.info('ADDING A NEW ONE');
            suites[isSuiteProp ? newVal.value : ''] = isSuiteVal
                ? Array.isArray(newVal.value) ? newVal.value : [newVal.value]
                : [];
        } else {
            /**
             * update existing items
             */
            suites = entries.reduce((prev, [k, v], i) => {
                if (newVal.index === i) {
                    console.info('UPDATING WITH INDEX', i);
                    prev[isSuiteProp ? newVal.value : k] = isSuiteVal
                        ? Array.isArray(newVal.value)
                            ? newVal.value
                            : [newVal.value]
                        : v;
                } else {
                    console.info('leep', k, v);
                    prev[k] = v;
                }
                return prev;
            }, {} as Record<string, string[]>);
        }
        newProperty = 'suites';
        newValue = suites;
    }

    // @ts-ignore
    state[newProperty as any] = newValue;
    console.log('Update property', newProperty, 'to', newValue);
    vscode.setState(state);
    vscode.postMessage({
        type: 'update',
        data: { property: newProperty, value: newValue }
    });
};

const registerListener = (formFields: (VscodeInputbox | VscodeMultiSelect | VscodeSingleSelect)[]) => {
    for (const input of formFields) {
        const name = input.getAttribute('name');
    
        if (!name) {
            console.error(`Couldn't initiate input ${input}`);
            continue;
        }
    
        initialJson[name] = getInputValue(input).value;
        input.addEventListener('vsc-change', onChangeListener as any);
    }
    console.log('NEW INITIAL', initialJson);
};

const reininitiateState = () => {
    const state = vscode.getState();
    console.log(`Reinstantiate state`, state);
    for (const [key, val] of Object.entries(state)) {
        if (key === 'suites') {
            let i = 0;
            for (const [suiteName, suiteSpecs] of Object.entries(val as Record<string, string[]>)) {
                const suiteNameElem = document.querySelector(`*[name="suiteName[${i}]"]`) as LitElement;
                setInputValue(suiteNameElem, { index: i, value: suiteName });
                const suiteSpecsElem = document.querySelector(`*[name="suiteSpecs[${i}]"]`) as LitElement;
                setInputValue(suiteSpecsElem, { index: i, value: suiteSpecs.join('\n') });
                ++i;
            }
        } else {
            const formElem = document.querySelector(`*[name="${key}"]`) as LitElement;
            if (!formElem) {
                console.error(`Couldn't find elem with selector "*[name="${key}"]"`);
                continue;
            }
            setInputValue(formElem, val);
        }
    }
};

registerListener(formFields);
const state = vscode.getState();
if (!state) {
    console.log(`Initiate state`, initialJson);
    vscode.setState(initialJson);
} else {
    
}
