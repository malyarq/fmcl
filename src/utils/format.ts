
/**
 * Format bytes to human readable string
 */
export function formatSize(bytes: number | undefined): string {
    if (bytes === undefined || bytes === null) return 'Unknown';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format date timestamp
 */
export function formatDate(timestamp: number | undefined, unknownText: string = 'Unknown'): string {
    if (!timestamp) return unknownText;
    return new Date(timestamp).toLocaleDateString();
}
