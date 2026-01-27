import { useCallback, useState } from 'react';

export function useLocalStorageState<T>(
  key: string,
  deserialize: (raw: string | null) => T,
  serialize: (val: T) => string,
): readonly [T, (val: T) => void] {
  const [state, setState] = useState<T>(() => deserialize(localStorage.getItem(key)));

  const set = useCallback((val: T) => {
    setState(val);
    localStorage.setItem(key, serialize(val));
  }, [key, serialize]);

  return [state, set] as const;
}

export function deserializeString(fallback = '') {
  return (raw: string | null) => raw ?? fallback;
}

export function serializeString(val: string) {
  return val;
}

export function deserializeBoolean(fallback: boolean) {
  return (raw: string | null) => {
    if (raw === null) return fallback;
    return raw === 'true';
  };
}

export function serializeBoolean(val: boolean) {
  return val.toString();
}

export function deserializeInt(fallback: number) {
  return (raw: string | null) => {
    const value = parseInt(raw ?? '', 10);
    return Number.isFinite(value) ? value : fallback;
  };
}

export function serializeInt(val: number) {
  return String(val);
}

