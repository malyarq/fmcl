import { useCallback, useRef, useState } from 'react';
import { useInstanceInvalidation } from '../../instances/hooks/useInstanceInvalidation';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import type { ModLoaderType } from '../../../contexts/instances/types';
import type { RuntimeDependencyState } from '../../../components/sidebar/modpackRuntimeDependencies';
import { getCreateRuntimeDependencyErrorMessage } from '../../../components/sidebar/modpackRuntimeDependencies';
import { instancesIPC } from '../../../services/ipc/instancesIPC';

export interface ModpackCreationDraft {
  name: string;
  description: string;
  version: string;
  minecraftVersion: string;
  useForge: boolean;
  useFabric: boolean;
  useNeoForge: boolean;
  useOptiFine: boolean;
}

export type ModpackCreationDraftStatus = 'empty' | 'restored' | 'active' | 'invalid';

export interface ModpackCreationCommit {
  id: string;
  needsCanonicalSync: boolean;
}

const DRAFT_STORAGE_KEY = 'modpack_creation_draft';
const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 4_000;
const MAX_VERSION_LENGTH = 64;

function getDefaultDraft(): ModpackCreationDraft {
  return {
    name: '',
    description: '',
    version: '1.0.0',
    minecraftVersion: '1.20.1',
    useForge: false,
    useFabric: false,
    useNeoForge: false,
    useOptiFine: false,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function parseStoredDraft(raw: string): ModpackCreationDraft | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isPlainRecord(parsed)) return null;
  if (!isBoundedString(parsed.name, MAX_NAME_LENGTH)) return null;
  if (!isBoundedString(parsed.description, MAX_DESCRIPTION_LENGTH)) return null;
  if (!isBoundedString(parsed.version, MAX_VERSION_LENGTH) || !parsed.version.trim()) return null;
  if (!isBoundedString(parsed.minecraftVersion, MAX_VERSION_LENGTH) || !parsed.minecraftVersion.trim()) return null;
  if (typeof parsed.useForge !== 'boolean') return null;
  if (typeof parsed.useFabric !== 'boolean') return null;
  if (typeof parsed.useNeoForge !== 'boolean') return null;
  if (typeof parsed.useOptiFine !== 'boolean') return null;

  const selectedLoaders = [parsed.useForge, parsed.useFabric, parsed.useNeoForge].filter(Boolean).length;
  if (selectedLoaders > 1) return null;

  return {
    name: parsed.name,
    description: parsed.description,
    version: parsed.version,
    minecraftVersion: parsed.minecraftVersion,
    useForge: parsed.useForge,
    useFabric: parsed.useFabric,
    useNeoForge: parsed.useNeoForge,
    useOptiFine: parsed.useOptiFine,
  };
}

type InitialDraftState = {
  draft: ModpackCreationDraft;
  status: ModpackCreationDraftStatus;
};

function readInitialDraft(): InitialDraftState {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw === null) return { draft: getDefaultDraft(), status: 'empty' };
    const restored = parseStoredDraft(raw);
    return restored
      ? { draft: restored, status: 'restored' }
      : { draft: getDefaultDraft(), status: 'invalid' };
  } catch (error) {
    console.error('Unable to read the modpack creation draft:', error);
    return { draft: getDefaultDraft(), status: 'invalid' };
  }
}

function writeDraft(draft: ModpackCreationDraft): boolean {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch (error) {
    console.error('Unable to persist the modpack creation draft:', error);
    return false;
  }
}

function clearStoredDraft(): boolean {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Unable to clear the modpack creation draft:', error);
    return false;
  }
}

function resolveModLoaderType(draft: ModpackCreationDraft): ModLoaderType {
  if (draft.useNeoForge) return 'neoforge';
  if (draft.useForge) return 'forge';
  if (draft.useFabric) return 'fabric';
  return 'vanilla';
}

export function useModpackCreationDraft() {
  const { t } = useSettings();
  const { invalidateInstances: refresh } = useInstanceInvalidation();
  const toast = useToast();
  const initialStateRef = useRef<InitialDraftState | null>(null);
  if (initialStateRef.current === null) initialStateRef.current = readInitialDraft();

  const [draft, setDraft] = useState(initialStateRef.current.draft);
  const draftRef = useRef(draft);
  const [draftStatus, setDraftStatus] = useState(initialStateRef.current.status);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [committedId, setCommittedId] = useState<string | null>(null);
  const committedIdRef = useRef<string | null>(null);
  const [needsCanonicalSync, setNeedsCanonicalSync] = useState(false);
  const pendingCreateRef = useRef<Promise<ModpackCreationCommit | null> | null>(null);
  const pendingSyncRef = useRef<Promise<boolean> | null>(null);

  const validateName = useCallback((value: string): string | null => {
    if (!value.trim()) return t('modpacks.name_required') || 'Modpack name is required';
    if (value.trim().length < 2) {
      return t('validation.name_too_short') || 'Name must contain at least 2 characters';
    }
    if (value.trim().length > MAX_NAME_LENGTH) {
      return t('validation.name_too_long') || 'Name must not exceed 50 characters';
    }
    return null;
  }, [t]);

  const updateDraft = useCallback((patch: Partial<ModpackCreationDraft>) => {
    if (draftStatus === 'invalid') return;
    const nextDraft = { ...draftRef.current, ...patch };
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setDraftStatus((current) => current === 'restored' ? 'restored' : 'active');
    if ('name' in patch && patch.name !== undefined) setNameError(validateName(patch.name));
    setError(null);
    writeDraft(nextDraft);
  }, [draftStatus, validateName]);

  const validateCurrentName = useCallback(() => {
    const validation = validateName(draftRef.current.name);
    setNameError(validation);
    return validation;
  }, [validateName]);

  const resetDraft = useCallback(() => {
    if (!clearStoredDraft()) return false;
    const nextDraft = getDefaultDraft();
    draftRef.current = nextDraft;
    setDraft(nextDraft);
    setDraftStatus('empty');
    setNameError(null);
    setError(null);
    return true;
  }, []);

  const resetAfterCompletion = useCallback(() => {
    clearStoredDraft();
    const nextDraft = getDefaultDraft();
    draftRef.current = nextDraft;
    committedIdRef.current = null;
    setDraft(nextDraft);
    setDraftStatus('empty');
    setNameError(null);
    setError(null);
    setCommittedId(null);
    setNeedsCanonicalSync(false);
  }, []);

  const create = useCallback((runtime: RuntimeDependencyState): Promise<ModpackCreationCommit | null> => {
    if (pendingCreateRef.current) return pendingCreateRef.current;

    const existingId = committedIdRef.current;
    if (existingId) {
      return Promise.resolve({ id: existingId, needsCanonicalSync });
    }

    const operation = (async () => {
      const validation = validateCurrentName();
      if (validation) return null;

      setIsSubmitting(true);
      setError(null);
      try {
        const currentDraft = draftRef.current;
        const modLoaderType = resolveModLoaderType(currentDraft);
        const result = await instancesIPC.create({
          name: currentDraft.name.trim(),
          source: {
            source: 'local',
            version: currentDraft.version.trim(),
            ...(currentDraft.description.trim() ? { description: currentDraft.description.trim() } : {}),
          },
          config: {
            runtime: {
              minecraftVersion: currentDraft.minecraftVersion.trim(),
              modLoader: { type: modLoaderType },
            },
            ...(runtime.useOptiFine ? { game: { useOptiFine: true } } : {}),
          },
        });
        if (!result.ok) throw new Error(result.error.message);
        if (!result.value.selectedId) throw new Error('Created instance did not return a selected ID');

        const id = result.value.selectedId;
        committedIdRef.current = id;
        setCommittedId(id);
        clearStoredDraft();

        let canonicalSyncFailed = false;
        try {
          await refresh();
        } catch (syncError) {
          canonicalSyncFailed = true;
          console.error('Unable to refresh canonical state after modpack creation:', syncError);
        }
        setNeedsCanonicalSync(canonicalSyncFailed);
        return { id, needsCanonicalSync: canonicalSyncFailed };
      } catch (createError) {
        console.error('Error creating modpack:', createError);
        const message = getCreateRuntimeDependencyErrorMessage(runtime, t)
          ?? (t('modpacks.create_error') || 'Error creating modpack');
        setError(message);
        toast.error(message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    })();

    pendingCreateRef.current = operation;
    void operation.finally(() => {
      if (pendingCreateRef.current === operation) pendingCreateRef.current = null;
    });
    return operation;
  }, [needsCanonicalSync, refresh, t, toast, validateCurrentName]);

  const retryCanonicalSync = useCallback((): Promise<boolean> => {
    if (!committedIdRef.current) return Promise.resolve(false);
    if (!needsCanonicalSync) return Promise.resolve(true);
    if (pendingSyncRef.current) return pendingSyncRef.current;

    const operation = (async () => {
      setIsSubmitting(true);
      try {
        await refresh();
        setNeedsCanonicalSync(false);
        return true;
      } catch (syncError) {
        console.error('Unable to retry canonical state refresh after modpack creation:', syncError);
        setNeedsCanonicalSync(true);
        return false;
      } finally {
        setIsSubmitting(false);
      }
    })();

    pendingSyncRef.current = operation;
    void operation.finally(() => {
      if (pendingSyncRef.current === operation) pendingSyncRef.current = null;
    });
    return operation;
  }, [needsCanonicalSync, refresh]);

  return {
    draft,
    draftStatus,
    nameError,
    error,
    isSubmitting,
    committedId,
    needsCanonicalSync,
    modLoaderType: resolveModLoaderType(draft),
    updateDraft,
    validateCurrentName,
    resetDraft,
    resetAfterCompletion,
    create,
    retryCanonicalSync,
  };
}
