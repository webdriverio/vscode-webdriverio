import { Disposable, ExtensionContext, window } from 'vscode';
import { format as printf } from 'util';
import {
  LOG_LEVEL,
  DEFAULT_MODE_LOG_LEVEL,
  OUTPUT_CHANNEL_NAME,
} from '../constants';

type LogLevelString = keyof typeof LOG_LEVEL;

let logger: LoggerService;

export class LoggerService implements Disposable {
    private _logLevel: LOG_LEVEL = LOG_LEVEL.INFO;
    private outputChannel = window.createOutputChannel(OUTPUT_CHANNEL_NAME);

    /**
     * Instantiate with a log level, if desired
     */
    private constructor(
        ctx: ExtensionContext,
        logLevel?: LOG_LEVEL | LogLevelString
    ) {
        if (typeof logLevel === 'string') {
            this.logLevel = LOG_LEVEL[logLevel];
        } else if (typeof logLevel === 'number') {
            this.logLevel = logLevel;
        } else {
            this.logLevel = DEFAULT_MODE_LOG_LEVEL[ctx.extensionMode];
        }
    }

    public static get(
        ctx?: ExtensionContext,
        logLevel?: LOG_LEVEL | LogLevelString
    ) {
        if (logger) {
            return logger;
        }
        if (!ctx) {
            throw new ReferenceError(
                'must pass ExtensionContext on first initialization'
            );
        }
        return (logger = new LoggerService(ctx, logLevel));
    }

    public get logLevel() {
        return this._logLevel;
    }

    public set logLevel(value: LOG_LEVEL) {
        this._logLevel = value;
    }

    /**
     * Append messages to the output channel and format it with a title
     */
    public debug(...args: any[]) {
        if (this.logLevel <= LOG_LEVEL.DEBUG) {
            this.writeLog(LOG_LEVEL.DEBUG, ...args);
        }
    }

    /**
     * Disposes the output channel
     */
    public dispose() {
        this.outputChannel.dispose();
    }

    /**
     * Logs an exception. If it's a proper `Error`, nicely format the message and dump the stack.
     * Otherwise, just dump or write raw if `string`.
     */
    public error(error: Error | string) {
        if (this.logLevel <= LOG_LEVEL.ERROR) {
            if (typeof error === 'string') {
                // Errors as a string usually only happen with
                // plugins that don't return the expected error.
                this.write(error);
            } else if (error?.message || error?.stack) {
                if (error?.message) {
                    this.writeLog(LOG_LEVEL.ERROR, error.message);
                }
                if (error?.stack) {
                    this.write(error.stack);
                }
            } else {
                this.dir(error);
            }
        }
    }

    /**
     * Util function to format printf-style
     */
    public format(...args: any[]) {
        return printf(...args);
    }

    /**
     * Append messages to the output channel and format it with a title
     */
    public info(...args: any[]): void {
        if (this.logLevel <= LOG_LEVEL.INFO) {
            this.writeLog(LOG_LEVEL.INFO, ...args);
        }
    }

    /**
     * Shows the output channel
     */
    public show() {
        this.outputChannel.show();
    }

    /**
     * Append messages to the output channel and format it with a title
     */
    public warn(...args: any[]): void {
        if (this.logLevel <= LOG_LEVEL.WARN) {
            this.writeLog(LOG_LEVEL.WARN, ...args);
        }
    }

    /**
     * Object dumper; only visible at DEBUG level.
     */
    private dir(data: any) {
        if (this.logLevel <= LOG_LEVEL.DEBUG) {
            this.write(this.format('%O', data));
        }
    }

    /**
     * Convenience to write directly to the output channel
     */
    private write(message: string) {
        this.outputChannel.appendLine(message);
    }

    /**
     * Append messages to the output channel and format it with a title
     *
     * @param logLevel - The log level the message originates from
     * @param args - Set of printf-style args to be formatted
     */
    private writeLog(logLevel: LOG_LEVEL, ...args: any[]) {
        this.write(
            this.format(
                '%s [%s] %s',
                LOG_LEVEL[logLevel],
                new Date().toLocaleTimeString(),
                this.format(...args)
            )
        );
    }
}
