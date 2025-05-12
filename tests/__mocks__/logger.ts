import { vi } from 'vitest'

export const log = {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
}
