import type { LitElement } from 'lit-element';

export interface VscChangeEvent {
    srcElement: LitElement
}

export interface LoaderParameters {
    modulePath: string
}

export type IndexedValue = { index: number, value: string };