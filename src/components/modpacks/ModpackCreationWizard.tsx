import React, { useState, useEffect, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useModpack } from '../../contexts/ModpackContext';
import { useToast } from '../../contexts/ToastContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { ErrorMessage } from '../ui/ErrorMessage';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModLoaderType } from '../../contexts/instances/types';
import { useVersions } from '../../features/launcher/hooks/useVersions';
import { useModSupportedVersions } from '../../features/launcher/hooks/useModSupportedVersions';
import { ModloaderSection } from '../sidebar/ModloaderSection';
import { OptifineToggle } from '../sidebar/OptifineToggle';
import { AddModModal } from './AddModModal';
import { ModpackDetailsModsTab, type ModpackModEntry } from './details';
import { cn } from '../../utils/cn';

interface ModpackDraft {
  name: string;
  description: string;
  version: string;
  minecraftVersion: string;
  useForge: boolean;
  useFabric: boolean;
  useNeoForge: boolean;
  useOptiFine: boolean;
  mods: Array<{ id: string; name: string }>;
}

const DRAFT_STORAGE_KEY = 'modpack_creation_draft';

interface ModpackCreationWizardProps {
  onBack: () => void;
  onCreated?: (modpackId: string) => void;
}

type WizardStep = 1 | 2 | 3;

export const ModpackCreationWizard: React.FC<ModpackCreationWizardProps> = ({
  onBack,
  onCreated,
}) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const { refresh } = useModpack();
  const toast = useToast();
  const confirm = useConfirm();
  const { versions } = useVersions();
  const { forgeVersions, fabricVersions, neoForgeVersions, optiFineVersions } = useModSupportedVersions();

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step3ModpackId, setStep3ModpackId] = useState<string | null>(null);
  const [step3Mods, setStep3Mods] = useState<ModpackModEntry[]>([]);
  const [step3LoadingMods, setStep3LoadingMods] = useState(false);
  const [step3ModSearchQuery, setStep3ModSearchQuery] = useState('');
  const [step3ModFilterStatus, setStep3ModFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [showAddModModal, setShowAddModModal] = useState(false);

  // Load draft from localStorage on mount
  const loadDraft = useCallback((): ModpackDraft | null => {
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading draft:', e);
    }
    return null;
  }, []);

  // Save draft to localStorage
  const saveDraft = useCallback((draft: Partial<ModpackDraft>) => {
    try {
      const current = loadDraft() || getDefaultDraft();
      const updated = { ...current, ...draft };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving draft:', e);
    }
  }, [loadDraft]);

  const getDefaultDraft = (): ModpackDraft => ({
    name: '',
    description: '',
    version: '1.0.0',
    minecraftVersion: '1.20.1',
    useForge: false,
    useFabric: false,
    useNeoForge: false,
    useOptiFine: false,
    mods: [],
  });

  const [draft, setDraft] = useState<ModpackDraft>(getDefaultDraft);

  // Reset state on mount — каждый раз начинаем с нуля
  useEffect(() => {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setDraft(getDefaultDraft());
    setCurrentStep(1);
    setStep3ModpackId(null);
    setError(null);
  }, []);

  // Auto-save draft on changes (только для восстановления при случайном закрытии в течение сессии)
  useEffect(() => {
    saveDraft(draft);
  }, [draft, saveDraft]);

  const [nameError, setNameError] = useState<string | null>(null);

  const validateName = (value: string): string | null => {
    if (!value.trim()) {
      return t('modpacks.name_required') || 'Имя модпака обязательно';
    }
    if (value.trim().length < 2) {
      return t('validation.name_too_short') || 'Имя должно содержать минимум 2 символа';
    }
    if (value.trim().length > 50) {
      return t('validation.name_too_long') || 'Имя не должно превышать 50 символов';
    }
    return null;
  };

  const isOptiFineSupported = optiFineVersions.includes(draft.minecraftVersion);

  const modLoaderType: ModLoaderType = draft.useNeoForge ? 'neoforge' : draft.useForge ? 'forge' : draft.useFabric ? 'fabric' : 'vanilla';

  const setLoader = (loader: 'vanilla' | 'forge' | 'fabric' | 'neoforge') => {
    setDraft((prev) => ({
      ...prev,
      useForge: loader === 'forge',
      useFabric: loader === 'fabric',
      useNeoForge: loader === 'neoforge',
    }));
  };

  const createModpackForStep3 = useCallback(async (): Promise<string | null> => {
    const nameValidation = validateName(draft.name);
    if (nameValidation) return null;
    const modLoader = modLoaderType !== 'vanilla'
      ? { type: modLoaderType, version: undefined }
      : undefined;
    const result = await modpacksIPC.createLocal(
      draft.name.trim(),
      draft.version.trim(),
      draft.minecraftVersion.trim(),
      modLoader,
      minecraftPath
    );
    if (result?.id && draft.description.trim()) {
      await modpacksIPC.updateMetadata(result.id, { description: draft.description.trim() }, minecraftPath);
    }
    return result?.id ?? null;
  }, [draft.name, draft.version, draft.minecraftVersion, draft.description, modLoaderType, minecraftPath]);

  const loadStep3Mods = useCallback(async () => {
    if (!step3ModpackId) return;
    setStep3LoadingMods(true);
    try {
      const modsList = await modpacksIPC.getMods(step3ModpackId, minecraftPath);
      const modsWithStatus: ModpackModEntry[] = modsList.map((mod) => ({
        ...mod,
        enabled: !mod.file.name.endsWith('.disabled'),
      }));
      setStep3Mods(modsWithStatus);
    } catch (err) {
      console.error('Error loading mods:', err);
      setStep3Mods([]);
    } finally {
      setStep3LoadingMods(false);
    }
  }, [step3ModpackId, minecraftPath]);

  useEffect(() => {
    if (currentStep === 3 && step3ModpackId) {
      loadStep3Mods();
    }
  }, [currentStep, step3ModpackId, loadStep3Mods]);

  const handleNext = async () => {
    if (currentStep === 1) {
      const validation = validateName(draft.name);
      if (validation) {
        setNameError(validation);
        return;
      }
      setNameError(null);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (step3ModpackId) {
        setCurrentStep(3);
        return;
      }
      setCreating(true);
      setError(null);
      try {
        const id = await createModpackForStep3();
        if (id) {
          setStep3ModpackId(id);
          await refresh();
          setCurrentStep(3);
        } else {
          setNameError(validateName(draft.name));
          setCurrentStep(1);
        }
      } catch (err) {
        console.error('Error creating modpack:', err);
        const errorMessage = t('modpacks.create_error') || 'Ошибка при создании модпака';
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setCreating(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const handleCreate = async () => {
    if (step3ModpackId) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      await refresh();
      setDraft(getDefaultDraft());
      setCurrentStep(1);
      setStep3ModpackId(null);
      setStep3Mods([]);
      onCreated?.(step3ModpackId);
      return;
    }

    const nameValidation = validateName(draft.name);
    if (nameValidation) {
      setNameError(nameValidation);
      setCurrentStep(1);
      return;
    }

    setCreating(true);
    setError(null);
    setNameError(null);

    try {
      const modLoader = modLoaderType !== 'vanilla'
        ? { type: modLoaderType, version: undefined }
        : undefined;

      const result = await modpacksIPC.createLocal(
        draft.name.trim(),
        draft.version.trim(),
        draft.minecraftVersion.trim(),
        modLoader,
        minecraftPath
      );

      if (result?.id && draft.description.trim()) {
        await modpacksIPC.updateMetadata(result.id, { description: draft.description.trim() }, minecraftPath);
      }

      localStorage.removeItem(DRAFT_STORAGE_KEY);
      await refresh();
      setDraft(getDefaultDraft());
      setCurrentStep(1);
      onCreated?.(result.id);
    } catch (err) {
      console.error('Error creating modpack:', err);
      const errorMessage = t('modpacks.create_error') || 'Ошибка при создании модпака';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveStep3Mod = async (mod: ModpackModEntry) => {
    if (!step3ModpackId) return;
    const confirmed = await confirm.confirm({
      title: t('modpacks.remove') || 'Удалить мод',
      message:
        t('modpacks.remove_mod_confirm')?.replace('{{name}}', mod.name) || `Удалить мод "${mod.name}"?`,
      variant: 'danger',
      confirmText: t('modpacks.remove') || 'Удалить',
      cancelText: t('general.cancel') || 'Отмена',
    });
    if (confirmed) {
      try {
        await modpacksIPC.removeMod(step3ModpackId, mod.file.name, minecraftPath);
        await loadStep3Mods();
      } catch (err) {
        console.error('Error removing mod:', err);
        toast.error(t('modpacks.remove_mod_error') || 'Ошибка при удалении мода');
      }
    }
  };

  const handleClose = () => {
    // Draft is auto-saved, so we can just go back
    onBack();
  };

  const canProceedFromStep1 = draft.name.trim() && !nameError;
  const canProceedFromStep2 = true; // Version and loader are always valid
  const canProceedFromStep3 = true; // Mods are optional

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        {t('wizard.step1_desc') || 'Enter basic information about your modpack'}
      </div>
      <Input
        label={t('modpacks.name')}
        value={draft.name}
        onChange={(e) => {
          const value = e.target.value;
          setDraft((prev) => ({ ...prev, name: value }));
          setNameError(validateName(value));
          setError(null);
        }}
        onBlur={(e) => {
          setNameError(validateName(e.target.value));
        }}
        placeholder={t('modpacks.new_placeholder')}
        error={nameError || undefined}
        required
        autoFocus
      />

      <Textarea
        label={t('modpacks.description') || 'Описание'}
        value={draft.description}
        onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
        placeholder={t('modpacks.description_placeholder')}
        rows={3}
      />
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
        {t('wizard.step2_desc') || 'Select Minecraft version and modloader'}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label={t('modpacks.version')}
          value={draft.version}
          onChange={(e) => setDraft((prev) => ({ ...prev, version: e.target.value }))}
          placeholder="1.0.0"
        />

        <Select
          label={t('modpacks.minecraft_version')}
          value={draft.minecraftVersion}
          onChange={(e) => setDraft((prev) => ({ ...prev, minecraftVersion: e.target.value }))}
        >
          {versions.filter(v => v.type === 'release').map((v) => (
            <option key={v.id} value={v.id}>
              {v.id}
            </option>
          ))}
        </Select>
      </div>

      <ModloaderSection
        version={draft.minecraftVersion}
        useForge={draft.useForge}
        setUseForge={(val) => setDraft((prev) => ({ ...prev, useForge: val }))}
        useFabric={draft.useFabric}
        setUseFabric={(val) => setDraft((prev) => ({ ...prev, useFabric: val }))}
        useNeoForge={draft.useNeoForge}
        setUseNeoForge={(val) => setDraft((prev) => ({ ...prev, useNeoForge: val }))}
        setLoader={setLoader}
        forgeSupportedVersions={forgeVersions}
        fabricSupportedVersions={fabricVersions}
        neoForgeSupportedVersions={neoForgeVersions}
        t={t}
        getAccentStyles={getAccentStyles}
      />

      <OptifineToggle
        isOptiFineSupported={isOptiFineSupported}
        useForge={draft.useForge}
        useOptiFine={draft.useOptiFine}
        setUseOptiFine={(val) => setDraft((prev) => ({ ...prev, useOptiFine: val }))}
        t={t}
        getAccentStyles={getAccentStyles}
      />
    </div>
  );

  const handleStep3ModToggle = () => {
    toast.info(t('modpacks.mod_toggle_coming_soon') || 'Включение/выключение модов будет доступно в будущем обновлении');
  };

  const renderStep3 = () => {
    if (!step3ModpackId) {
      return (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t('modpacks.creating') || 'Создание...'}</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <div className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 space-y-2">
          <p>{t('wizard.step3_desc') || 'Add mods to your modpack (optional).'}</p>
          <p>{t('wizard.step3_desc2') || 'You can skip this step and add mods later.'}</p>
        </div>
        <ModpackDetailsModsTab
          mods={step3Mods}
          loadingMods={step3LoadingMods}
          modSearchQuery={step3ModSearchQuery}
          onModSearchQueryChange={setStep3ModSearchQuery}
          modFilterStatus={step3ModFilterStatus}
          onModFilterStatusChange={setStep3ModFilterStatus}
          onAddMod={() => setShowAddModModal(true)}
          onRemoveMod={handleRemoveStep3Mod}
          onModToggle={handleStep3ModToggle}
          t={t}
          getAccentStyles={getAccentStyles}
        />
        <AddModModal
          modpackId={step3ModpackId}
          isOpen={showAddModModal}
          onClose={() => setShowAddModModal(false)}
          onAdded={() => {
            loadStep3Mods();
            setShowAddModModal(false);
          }}
          defaultMCVersion={draft.minecraftVersion}
          defaultLoader={modLoaderType !== 'vanilla' ? modLoaderType : undefined}
        />
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header with back button */}
      <div className="flex items-center gap-4 p-6 border-b border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-900/40">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleClose}
          className="flex items-center gap-2"
        >
          <span>←</span>
          {t('general.back') || 'Назад'}
        </Button>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white flex-1">
          {t('modpacks.create_new') || 'Создать новый модпак'}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="max-w-2xl mx-auto space-y-6">
        {/* Progress indicator */}
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((step) => (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all',
                    currentStep === step
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : currentStep > step
                      ? 'bg-emerald-500 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
                  )}
                  style={
                    currentStep === step
                      ? getAccentStyles('bg').style
                      : undefined
                  }
                >
                  {currentStep > step ? '✓' : step}
                </div>
                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 text-center leading-tight max-w-[4.5rem] mx-auto">
                  {step === 1
                    ? t('wizard.step1_title') || 'Basic Info'
                    : step === 2
                    ? t('wizard.step2_title') || 'Version & Loader'
                    : t('wizard.step3_title') || 'Add mods to the pack'}
                </div>
              </div>
              {step < 3 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-2 transition-all',
                    currentStep > step
                      ? 'bg-emerald-500'
                      : 'bg-zinc-200 dark:bg-zinc-700'
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[300px]">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {error && !nameError && (
          <ErrorMessage message={error} />
        )}

        {/* Navigation buttons */}
        <div className="flex gap-2 pt-4">
          {currentStep > 1 && (
            <Button variant="secondary" onClick={handleBack}>
              {t('wizard.back') || 'Back'}
            </Button>
          )}
          <div className="flex-1" />
          {currentStep < 3 ? (
            <Button
              variant="primary"
              onClick={() => void handleNext()}
              disabled={
                creating ||
                (currentStep === 1 && !canProceedFromStep1) ||
                (currentStep === 2 && !canProceedFromStep2) ||
                (currentStep === 3 && !canProceedFromStep3)
              }
              style={getAccentStyles('bg').style}
              isLoading={creating && currentStep === 2}
            >
              {t('wizard.next') || 'Next'}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={creating || !draft.name.trim() || !!nameError}
              style={getAccentStyles('bg').style}
              isLoading={creating}
            >
              {creating ? t('modpacks.creating') || 'Создание...' : t('modpacks.create')}
            </Button>
          )}
          <Button variant="secondary" onClick={handleClose}>
            {t('general.cancel')}
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
};
