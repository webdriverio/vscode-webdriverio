import ipc from 'node-ipc';
import WDIOReporter, { RunnerStats } from '@wdio/reporter';

import { Reporters } from '@wdio/types';

export interface Options extends Partial<Reporters.Options> {}

ipc.config.id = 'VSCodeReporter';
ipc.config.retry = 1000;

export default class VSCodeReporter extends WDIOReporter {
    constructor (options: any) {
        super(Object.assign({
            stdout: true,
            writeStream: { write: (...args: any[]) => {} }
        }, options));
        ipc.connectTo('vscodeWebdriverIO');
    }

    onRunnerStart (runnerStats: RunnerStats) {
        ipc.of.vscodeWebdriverIO.emit('onRunnerStart', runnerStats);
    }
    onBeforeCommand(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onBeforeCommand', payload);
    }
    onAfterCommand(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onAfterCommand', payload);
    }
    onSuiteStart(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onSuiteStart', payload);
    }
    onHookStart(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onHookStart', payload);
    }
    onHookEnd(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onHookEnd', payload);
    }
    onTestStart(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onTestStart', payload);
    }
    onTestPass(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onTestPass', payload);
    }
    onTestFail(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onTestFail', payload);
    }
    onTestRetry(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onTestRetry', payload);
    }
    onTestSkip(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onTestSkip', payload);
    }
    onTestEnd(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onTestEnd', payload);
    }
    onSuiteEnd(payload: any) {
        ipc.of.vscodeWebdriverIO.emit('onSuiteEnd', payload);
    }
    onRunnerEnd (runnerStats: RunnerStats) {
        ipc.of.vscodeWebdriverIO.emit('onRunnerEnd', runnerStats);
    }
}