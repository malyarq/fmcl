declare module 'b4a' {
    /**
     * Allocate a new buffer
     * @param size Size of the buffer
     */
    export function alloc(size: number): Buffer;

    /**
     * Concatenate multiple buffers
     * @param buffers Array of buffers to concatenate
     */
    export function concat(buffers: Buffer[]): Buffer;

    /**
     * Convert buffer to string
     * @param buffer Buffer to convert
     * @param encoding Encoding to use (e.g., 'hex', 'utf8')
     */
    export function toString(buffer: Buffer, encoding: string): string;

    /**
     * Create buffer from string
     * @param str String to convert
     * @param encoding Encoding to use (e.g., 'hex', 'utf8')
     */
    export function from(str: string, encoding: string): Buffer;
}
