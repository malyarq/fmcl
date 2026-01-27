import React, { useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useModpack } from '../../contexts/ModpackContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Modal } from '../ui/Modal';
import { ErrorMessage } from '../ui/ErrorMessage';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import type { ModLoaderType } from '../../contexts/instances/types';
import { useVersions } from '../../features/launcher/hooks/useVersions';
import { useModSupportedVersions } from '../../features/launcher/hooks/useModSupportedVersions';
import { ModloaderSection } from '../sidebar/ModloaderSection';
import { OptifineToggle } from '../sidebar/OptifineToggle';

interface CreateModpackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (modpackId: string) => void;
}

export const CreateModpackModal: React.FC<CreateModpackModalProps> = ({
  isOpen,
  onClose,
  onCreated,
}) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const { refresh } = useModpack();
  const toast = useToast();
  const { versions } = useVersions();
  const { forgeVersions, fabricVersions, neoForgeVersions, optiFineVersions } = useModSupportedVersions();
  
  const [name, setName] = useState('');
  const [version, setVersion] = useState('1.0.0');
  const [minecraftVersion, setMinecraftVersion] = useState('1.20.1');
  const [useForge, setUseForge] = useState(false);
  const [useFabric, setUseFabric] = useState(false);
  const [useNeoForge, setUseNeoForge] = useState(false);
  const [useOptiFine, setUseOptiFine] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  
  const isOptiFineSupported = optiFineVersions.includes(minecraftVersion);

  // Определяем текущий модлоадер
  const modLoaderType: ModLoaderType = useNeoForge ? 'neoforge' : useForge ? 'forge' : useFabric ? 'fabric' : 'vanilla';
  
  const setLoader = (loader: 'vanilla' | 'forge' | 'fabric' | 'neoforge') => {
    setUseForge(loader === 'forge');
    setUseFabric(loader === 'fabric');
    setUseNeoForge(loader === 'neoforge');
  };

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

  const handleCreate = async () => {
    const nameValidation = validateName(name);

    if (nameValidation) {
      setNameError(nameValidation);
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
        name.trim(),
        version.trim(),
        minecraftVersion.trim(),
        modLoader,
        minecraftPath
      );

      await refresh();
      onCreated?.(result.id);
      onClose();
      
      // Reset form
      setName('');
      setVersion('1.0.0');
      setMinecraftVersion('1.20.1');
      setUseForge(false);
      setUseFabric(false);
      setUseNeoForge(false);
      setUseOptiFine(false);
    } catch (err) {
      console.error('Error creating modpack:', err);
      const errorMessage = t('modpacks.create_error') || 'Ошибка при создании модпака';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('modpacks.create_new') || 'Создать новый модпак'}>
      <div className="space-y-4">
        <Input
          label={t('modpacks.name')}
          value={name}
          onChange={(e) => {
            const value = e.target.value;
            setName(value);
            setNameError(validateName(value));
            setError(null);
          }}
          onBlur={(e) => {
            setNameError(validateName(e.target.value));
          }}
          placeholder={t('modpacks.new_placeholder')}
          error={nameError || undefined}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={t('modpacks.version')}
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="1.0.0"
            className="font-mono"
          />

          <Select
            label={t('modpacks.minecraft_version')}
            value={minecraftVersion}
            onChange={(e) => setMinecraftVersion(e.target.value)}
            className="font-mono"
          >
            {versions.filter(v => v.type === 'release').map((v) => (
              <option key={v.id} value={v.id}>
                {v.id}
              </option>
            ))}
          </Select>
        </div>

        <ModloaderSection
          version={minecraftVersion}
          useForge={useForge}
          setUseForge={setUseForge}
          useFabric={useFabric}
          setUseFabric={setUseFabric}
          useNeoForge={useNeoForge}
          setUseNeoForge={setUseNeoForge}
          setLoader={setLoader}
          forgeSupportedVersions={forgeVersions}
          fabricSupportedVersions={fabricVersions}
          neoForgeSupportedVersions={neoForgeVersions}
          t={t}
          getAccentStyles={getAccentStyles}
        />

        <OptifineToggle
          isOptiFineSupported={isOptiFineSupported}
          useForge={useForge}
          useOptiFine={useOptiFine}
          setUseOptiFine={setUseOptiFine}
          t={t}
          getAccentStyles={getAccentStyles}
        />

        {error && !nameError && (
          <ErrorMessage message={error} />
        )}

        <div className="flex gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={creating || !name.trim() || !!nameError}
            className="flex-1"
            style={getAccentStyles('bg').style}
            isLoading={creating}
          >
            {creating ? t('modpacks.creating') || 'Создание...' : t('modpacks.create')}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            {t('general.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
