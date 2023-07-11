import { tests, type Disposable, type TestController } from 'vscode';

export class WebdriverIOTestController implements Disposable {
    #disposables: Disposable[] = [];

    constructor (private ctrl: TestController) {
        this.#disposables.push(ctrl);
        ctrl.resolveHandler = async (test) => {
            console.log('resolve', test);
            
        }
    }

    dispose () {
        this.#disposables.forEach((d) => d.dispose());
    }

    static create () {
        const ctrl = tests.createTestController('wdio', 'WebdriverIO');
        return new WebdriverIOTestController(ctrl);
    }
}