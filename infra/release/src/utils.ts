export const getCurrentDate = () => {
    const today = new Date()

    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')

    return `${yyyy}-${mm}-${dd}`
}

export const createPreReleaseVer = (version: string) => {
    const patchNumber = process.env.VSCODE_WDIO_PRE_RELEASE_PATCH_NUMBER || ''
    if (!patchNumber) {
        throw new Error('VSCODE_WDIO_PRE_RELEASE_PATCH_NUMBER is not set. Please check the environment variables.')
    }
    const [major, minor, patch] = version.split('.')
    const newVersion = [major, minor]
    newVersion.push(`${patch.split('-')[0]}${patchNumber}`.slice(0, 9))
    return `${newVersion.join('.')}`
}
