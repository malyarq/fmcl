export type IpcCallContext = {
  namespace: string;
  method: string;
};

export function toIpcError(ctx: IpcCallContext, err: unknown): Error {
  if (err instanceof Error) {
    const e = new Error(`[${ctx.namespace}] ${ctx.method} failed: ${err.message}`);
    e.name = err.name || 'IpcError';
    // Preserve original for debugging (non-standard but useful).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e as any).cause = err;
    return e;
  }
  return new Error(`[${ctx.namespace}] ${ctx.method} failed: ${String(err)}`);
}

