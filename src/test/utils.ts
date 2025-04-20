import * as path from 'node:path'
/**
 * Filter spec files by paths
 * @param allSpecs All spec files from configuration
 * @param filterPaths Paths to filter by
 * @returns Filtered spec files
 */
export function filterSpecsByPaths(allSpecs: string[], filterPaths: string[]): string[] {
    // Normalize paths for comparison
    const normalizedFilterPaths = filterPaths.map((file) => path.normalize(file))

    // Filter specs
    return allSpecs.filter((configSpec) => {
        const normalizedConfigSpec = path.normalize(configSpec)
        return normalizedFilterPaths.some((specFile) => {
            return (
                normalizedConfigSpec === specFile ||
                normalizedConfigSpec.includes(specFile) ||
                specFile.includes(normalizedConfigSpec)
            )
        })
    })
}
