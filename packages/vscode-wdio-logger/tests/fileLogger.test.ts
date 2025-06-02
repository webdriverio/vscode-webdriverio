import * as fs from 'node:fs'
import * as path from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { FileLogger } from '../src/fileLogger.js'

vi.mock('node:fs', () => {
    return {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        createWriteStream: vi.fn(() => ({
            on: vi.fn(),
        })),
    }
})

describe('FileLogger', () => {
    const mockFileAbsPath = process.platform === 'win32' ? 'c:\\work\\path\\to\\log' : '/work/path/to/log'
    const mockFileRelativePath = process.platform === 'win32' ? 'path\\to\\log' : 'path/to/log'

    const mockStream = {
        on: vi.fn(),
        end: vi.fn(),
        write: vi.fn(),
    } as unknown as fs.WriteStream

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('constructor', () => {
        it('should create WriteStream with absolute directory path', () => {
            new FileLogger(mockFileAbsPath)

            expect(fs.createWriteStream).toHaveBeenCalledWith(path.join(mockFileAbsPath, 'vscode-webdriverio.log'), {
                flags: 'a',
                encoding: 'utf8',
            })
        })

        it('should create WriteStream with relative directory path', () => {
            new FileLogger(mockFileRelativePath)

            expect(fs.createWriteStream).toHaveBeenCalledWith(
                path.join(process.cwd(), mockFileRelativePath, 'vscode-webdriverio.log'),
                {
                    flags: 'a',
                    encoding: 'utf8',
                }
            )
        })

        it('should ensure directory exists', () => {
            const logFilePath = path.join(mockFileAbsPath, 'vscode-webdriverio.log')
            vi.mocked(fs.existsSync).mockReturnValue(false)

            new FileLogger(mockFileAbsPath)

            expect(fs.mkdirSync).toHaveBeenCalledWith(path.dirname(logFilePath), {
                recursive: true,
            })
        })

        it('should throw error when failed to create stream', () => {
            vi.mocked(fs.createWriteStream).mockImplementation(() => {
                throw new Error('DUMMY ERROR')
            })

            expect(() => new FileLogger(mockFileAbsPath)).toThrowError('Failed to initialize FileLogger: DUMMY ERROR')
        })

        it('should not write the logs when error occurred once', () => {
            vi.mocked(fs.createWriteStream).mockReturnValue(mockStream)

            const fileLogger = new FileLogger(mockFileAbsPath)

            const event = vi.mocked(mockStream.on).mock.calls[0][0]
            const cb = vi.mocked(mockStream.on).mock.calls[0][1] as Function

            // Emulate the Error
            cb()
            fileLogger.write('Expects that this is not written')

            // Assertions
            expect(event).toBe('error')
            expect(fileLogger.isWritable).toBe(false)
            expect(mockStream.write).not.toHaveBeenCalled()
        })
    })

    describe('write', () => {
        it('should write the logs', () => {
            const dummyMsg = 'log message'

            vi.mocked(fs.createWriteStream).mockReturnValue(mockStream)

            const fileLogger = new FileLogger(mockFileAbsPath)
            fileLogger.write(dummyMsg)

            expect(mockStream.write).toHaveBeenCalledWith(`${dummyMsg}\n`)
        })

        it('should be disposed when error occurred', () => {
            vi.mocked(mockStream.write).mockImplementation(() => {
                throw new Error('DUMMY ERROR')
            })
            const dummyMsg = 'log message'

            vi.mocked(fs.createWriteStream).mockReturnValue(mockStream)

            const fileLogger = new FileLogger(mockFileAbsPath)
            expect(() => fileLogger.write(dummyMsg)).toThrowError('Failed to write log: DUMMY ERROR')
            expect(fileLogger.isWritable).toBe(false)
            expect(mockStream.end).toHaveBeenCalledOnce()
        })
    })

    describe('dispose', () => {
        it('should call end of the WriteStream', () => {
            vi.mocked(fs.createWriteStream).mockReturnValue(mockStream)
            const fileLogger = new FileLogger(mockFileAbsPath)

            // Pre-assertion
            expect(fileLogger.isWritable).toBe(true)

            // Act
            fileLogger.dispose()

            // Assertions
            expect(mockStream.end).toHaveBeenCalledOnce()
            expect(fileLogger.isWritable).toBe(false)
        })

        it('should call end of the WriteStream only once', () => {
            vi.mocked(fs.createWriteStream).mockReturnValue(mockStream)
            const fileLogger = new FileLogger(mockFileAbsPath)

            // Pre-assertion
            expect(fileLogger.isWritable).toBe(true)

            // Act
            fileLogger.dispose()
            fileLogger.dispose()

            // Assertions
            expect(mockStream.end).toHaveBeenCalledOnce()
            expect(fileLogger.isWritable).toBe(false)
        })
    })
})
