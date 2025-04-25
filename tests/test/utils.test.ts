import { describe, it, expect } from 'vitest'

import { filterSpecsByPaths } from '../../src/test/utils.js'

describe('Test Utils', () => {
    describe('filterSpecsByPaths', () => {
        it('should filter specs correctly with exact path match', () => {
            // Setup test data
            const allSpecs = ['/path/to/spec1.js', '/path/to/subfolder/spec2.js', '/another/path/spec3.js']

            // Test exact match
            const result = filterSpecsByPaths(allSpecs, ['/path/to/spec1.js'])
            expect(result).toEqual(['/path/to/spec1.js'])
        })

        it('should filter specs correctly with partial path match', () => {
            // Setup test data
            const allSpecs = ['/path/to/spec1.js', '/path/to/subfolder/spec2.js', '/another/path/spec3.js']

            // Test partial match - matching directory
            const result = filterSpecsByPaths(allSpecs, ['/path/to'])
            expect(result).toEqual(['/path/to/spec1.js', '/path/to/subfolder/spec2.js'])
        })

        it('should return empty array when no match is found', () => {
            // Setup test data
            const allSpecs = ['/path/to/spec1.js', '/path/to/subfolder/spec2.js', '/another/path/spec3.js']

            // Test no match
            const result = filterSpecsByPaths(allSpecs, ['/not/exist'])
            expect(result).toEqual([])
        })

        it('should handle array of filter paths', () => {
            // Setup test data
            const allSpecs = ['/path/to/spec1.js', '/path/to/subfolder/spec2.js', '/another/path/spec3.js']

            // Test multiple filter paths
            const result = filterSpecsByPaths(allSpecs, ['/path/to/spec1.js', '/another/path'])
            expect(result).toContain('/path/to/spec1.js')
            expect(result).toContain('/another/path/spec3.js')
            expect(result).not.toContain('/path/to/subfolder/spec2.js')
        })

        it('should handle empty inputs gracefully', () => {
            // Empty specs array
            expect(filterSpecsByPaths([], ['/some/path'])).toEqual([])

            // Empty filter paths array
            const allSpecs = ['/path/to/spec1.js', '/path/to/spec2.js']
            expect(filterSpecsByPaths(allSpecs, [])).toEqual([])
        })
    })
})
