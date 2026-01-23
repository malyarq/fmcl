// Allow importing JSON files in the renderer.
declare module '*.json' {
    const value: Record<string, unknown>;
    export default value;
}
