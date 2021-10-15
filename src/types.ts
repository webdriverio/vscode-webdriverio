import type { LitElement } from 'lit-element';

export interface VscChangeEvent {
    srcElement: LitElement
}

export interface LoaderParameters {
    modulePath: string
}

export type IndexedValue = { index: number, value: string };

export interface ComponentEvent extends CustomEvent {
    path: (HTMLElement | Window | Document)[]
}

export type ConfigType = 'string' | 'number' | 'boolean' | 'object' | 'function' | 'option' | 'suites' | 'capabilities' | 'plugin';
export type Option = { label: string, value?: string };
export type DefinitionEntry = {
    type: ConfigType
    name: string
    default?: any
    required?: boolean
    description: string,
    options?: string[] | Option[],
    multi?: boolean
};
export type Definition<T> = {
    [k in keyof T]: DefinitionEntry
};