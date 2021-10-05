import { ExtensionMode } from 'vscode';

export const plugin = 'webdriverio';
export const OUTPUT_CHANNEL_NAME = 'WebdriverIO';

/**
 * Log levels
 */
 export enum LOG_LEVEL {
    DEBUG,
    INFO,
    WARN,
    ERROR,
    QUIET,
}

/**
 * Mapping of extension modes to default log level
 */
export const DEFAULT_MODE_LOG_LEVEL = {
    [ExtensionMode.Test]: LOG_LEVEL.DEBUG,
    [ExtensionMode.Development]: LOG_LEVEL.DEBUG,
    [ExtensionMode.Production]: LOG_LEVEL.INFO,
} as const;