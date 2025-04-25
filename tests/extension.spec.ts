import * as chai from 'chai'
import * as sinon from 'sinon'
import * as vscode from 'vscode'

import { ServerManager } from '../src/api/index.js'
import { ExtensionConfigManager } from '../src/config/index.js'
import { activate, deactivate } from '../src/extension.js'
import { RepositoryManager, TestfileWatcher } from '../src/test/index.js'
import { log } from '../src/utils/logger.js'

const expect = chai.expect

describe('extension', async () => {
    let sandbox: sinon.SinonSandbox
    let fakeContext: any

    beforeEach(() => {
        sandbox = sinon.createSandbox()

        // Create fake context with subscriptions array
        fakeContext = {
            subscriptions: [],
        }
    })

    afterEach(() => {
        sandbox.restore()
        deactivate()
    })

    describe('activate', () => {
        let configManagerStub: sinon.SinonStub
        let serverManagerStartStub: sinon.SinonStub
        let repositoryManagerInitializeStub: sinon.SinonStub
        let repositoryManagerRegisterStub: sinon.SinonStub
        let testfileWatcherEnableStub: sinon.SinonStub
        let logInfoStub: sinon.SinonStub

        beforeEach(() => {
            // Stub ExtensionConfigManager methods
            configManagerStub = sandbox.stub(ExtensionConfigManager.prototype, 'initialize').resolves()
            sandbox.stub(ExtensionConfigManager.prototype, 'dispose').resolves()
            sandbox.stub(ExtensionConfigManager.prototype, 'getWdioConfigPaths').returns(['/test/wdio.conf.ts'])
            sandbox.stub(ExtensionConfigManager.prototype, 'listener').returns()

            // Stub ServerManager methods
            serverManagerStartStub = sandbox.stub(ServerManager.prototype, 'start').resolves()
            sandbox.stub(ServerManager.prototype, 'dispose').resolves()

            // Stub RepositoryManager methods
            repositoryManagerInitializeStub = sandbox.stub(RepositoryManager.prototype, 'initialize').resolves()
            repositoryManagerRegisterStub = sandbox
                .stub(RepositoryManager.prototype, 'registerToTestController')
                .returns()
            sandbox.stub(RepositoryManager.prototype, 'dispose').resolves()
            Object.defineProperty(RepositoryManager, 'repos', [
                {
                    discoverAllTests: sandbox.stub().resolves([]),
                },
            ])
            // sandbox.stub(RepositoryManager.prototype, 'repos').get(() => [
            //     {
            //         discoverAllTests: sandbox.stub().resolves()
            //     }
            // ])

            // Stub TestfileWatcher methods
            testfileWatcherEnableStub = sandbox.stub(TestfileWatcher.prototype, 'enable').returns()

            // Stub logger
            logInfoStub = sandbox.stub(log, 'info')

            // Stub vscode commands and workspace
            sandbox.stub(vscode.commands, 'registerCommand').returns({ dispose: () => {} })
            sandbox.stub(vscode.workspace, 'onDidChangeConfiguration').returns({ dispose: () => {} })
        })

        it('should successfully activate the extension', async () => {
            // Arrange & Act
            await activate(fakeContext)

            // Assert
            expect(logInfoStub).to.have.been.calledWith('WebdriverIO Runner extension is now active')
            expect(configManagerStub).to.have.been.called
            expect(serverManagerStartStub).to.have.been.called
            expect(repositoryManagerInitializeStub).to.have.been.called
            expect(repositoryManagerRegisterStub).to.have.been.called
            expect(testfileWatcherEnableStub).to.have.been.called

            // Verify context subscriptions
            expect(fakeContext.subscriptions).to.have.length.above(0)
        })

        it('should handle server start error gracefully', async () => {
            // Arrange
            const errorMessage = 'Failed to start server'
            serverManagerStartStub.rejects(new Error(errorMessage))
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage')
            const logErrorStub = sandbox.stub(log, 'error')

            // Act
            await activate(fakeContext)

            // Assert
            expect(logErrorStub).to.have.been.calledWith(`Failed to start worker process: ${errorMessage}`)
            expect(showErrorMessageStub).to.have.been.calledWith('Failed to start WebdriverIO worker process')
        })

        it('should continue activation even when serverManager.start rejects', async () => {
            // Arrange
            serverManagerStartStub.rejects(new Error('Server failed'))
            sandbox.stub(vscode.window, 'showErrorMessage')

            // Act
            await activate(fakeContext)

            // Assert
            expect(repositoryManagerInitializeStub).to.have.been.called
            expect(repositoryManagerRegisterStub).to.have.been.called
            expect(testfileWatcherEnableStub).to.have.been.called
        })

        describe('deactivate', () => {
            it('should dispose the extension instance when activate has been called', async () => {
                // Arrange
                // First activate the extension
                await activate(fakeContext)

                // Act
                await deactivate()

                // Assert
                expect(fakeContext.subscriptions).to.have.length.above(0)

                // The dispose method should clean up the internal disposables
                // When we call deactivate again, it should not throw
                expect(() => deactivate()).to.not.throw()
            })

            it('should not throw error when called without activate', () => {
                // Act & Assert
                expect(() => deactivate()).to.not.throw()
            })
        })
    })
})
