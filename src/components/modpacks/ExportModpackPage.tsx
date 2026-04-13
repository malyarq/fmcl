import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import { useToast } from '../../contexts/ToastContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import { ErrorMessage } from '../ui/ErrorMessage';
import { modpacksIPC } from '../../services/ipc/modpacksIPC';
import { dialogIPC } from '../../services/ipc/dialogIPC';
import { ArrowLeft } from 'lucide-react';

interface ExportModpackPageProps {
  modpackId: string;
  onBack: () => void;
}

type ExportFormat = 'curseforge' | 'modrinth' | 'zip' | 'multimc';

export const ExportModpackPage: React.FC<ExportModpackPageProps> = ({
  modpackId,
  onBack,
}) => {
  const { t, getAccentStyles, minecraftPath } = useSettings();
  const toast = useToast();
  const [modpackName, setModpackName] = useState('');
  const [format, setFormat] = useState<ExportFormat>('multimc');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [desktopPath, setDesktopPath] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState('');
  const [outputPathError, setOutputPathError] = useState<string | null>(null);
  const lastAutoOutputPathRef = useRef('');

  // Export Options
  const [includeSaves, setIncludeSaves] = useState(false);
  const [includeScreenshots, setIncludeScreenshots] = useState(false);
  const [includeResourcePacks, setIncludeResourcePacks] = useState(false);
  const [includeShaders, setIncludeShaders] = useState(false);
  const [includeMods, setIncludeMods] = useState(true);

  useEffect(() => {
    const loadModpackName = async () => {
      try {
        const metadata = await modpacksIPC.getMetadata(modpackId, minecraftPath);
        setModpackName(metadata.name || '');
      } catch (error) {
        console.error('Error loading modpack name:', error);
      }
    };
    loadModpackName();
  }, [modpackId, minecraftPath]);

  const getFileExtension = (fmt: ExportFormat): string => {
    if (fmt === 'modrinth') return 'mrpack';
    if (fmt === 'curseforge') return 'zip';
    if (fmt === 'multimc') return 'zip';
    return 'zip';
  };

  const getDefaultFileName = useCallback((fmt: ExportFormat = format) =>
    `${modpackName || 'modpack'}.${getFileExtension(fmt)}`, [format, modpackName]);

  const buildDefaultOutputPath = useCallback((fmt: ExportFormat = format, basePath: string | null = desktopPath) => {
    const fileName = getDefaultFileName(fmt);
    return basePath ? `${basePath}\\${fileName}` : fileName;
  }, [desktopPath, format, getDefaultFileName]);

  useEffect(() => {
    if (desktopPath) {
      return;
    }

    dialogIPC.getDesktopPath()
      .then(path => {
        setDesktopPath(path);
      })
      .catch(err => {
        console.error('Failed to get desktop path:', err);
      });
  }, [desktopPath]);

  useEffect(() => {
    const nextDefaultPath = buildDefaultOutputPath();

    if (!outputPath || outputPath === lastAutoOutputPathRef.current) {
      lastAutoOutputPathRef.current = nextDefaultPath;
      setOutputPath(nextDefaultPath);
    }
  }, [buildDefaultOutputPath, outputPath]);

  const validateOutputPath = (value: string): string | null => {
    if (!value.trim()) {
      return t('modpacks.output_path_required') || 'Путь для сохранения обязателен';
    }
    if (value.trim().length < 3) {
      return t('validation.path_too_short') || 'Путь слишком короткий';
    }
    return null;
  };

  const handleExport = async () => {
    const pathValidation = validateOutputPath(outputPath);
    if (pathValidation) {
      setOutputPathError(pathValidation);
      return;
    }

    setExporting(true);
    setError(null);
    setOutputPathError(null);

    try {
      // Prepare options if format supports it
      const options = (format === 'multimc' || format === 'zip') ? {
        includeSaves,
        includeScreenshots,
        includeResourcePacks,
        includeShaders,
        includeMods
      } : undefined;

      await modpacksIPC.export(modpackId, format, outputPath, options, minecraftPath);
      toast.success(t('modpacks.export_success') || 'Модпак успешно экспортирован!');
      onBack();
    } catch (err) {
      console.error('Error exporting modpack:', err);
      const errorMessage = t('modpacks.export_error') || 'Ошибка при экспорте модпака';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setExporting(false);
    }
  };

  const handleSelectPath = async () => {
    try {
      const result = await dialogIPC.showSaveDialog({
        title: t('modpacks.select_export_path') || 'Выберите путь для сохранения',
        defaultPath: desktopPath ? `${desktopPath}\\${getDefaultFileName()}` : getDefaultFileName(),
        filters: [
          {
            name: format === 'modrinth' ? 'Modrinth Pack' : 'ZIP Archive',
            extensions: [getFileExtension(format)],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (result && !result.canceled && result.filePath) {
        setOutputPath(result.filePath);
      }
    } catch (err) {
      console.error('Error selecting path:', err);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border/70 bg-card/78 px-6 py-4 backdrop-blur-md">
        <Breadcrumbs
          items={[
            { label: t('modpacks.title') || 'Modpacks', onClick: onBack },
            { label: t('modpacks.export_title') || 'Экспорт модпака', active: true }
          ]}
        />
        <div className="flex items-center gap-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            className="flex items-center gap-2"
            disabled={exporting}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('general.back') || 'Назад'}
          </Button>
          <div className="min-w-0 flex-1">
            <div className="kicker-label">{t('modpacks.title') || 'Modpacks'}</div>
            <h2 className="text-xl font-bold text-foreground">
              {t('modpacks.export_title') || 'Экспорт модпака'}
            </h2>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 min-h-0">
        <div className="space-y-6 max-w-2xl mx-auto">
          <div className="surface-muted p-4">
            <p className="text-sm text-secondary">
              {t('modpacks.export_desc')?.replace('{{name}}', modpackName) || `Экспортировать модпак "${modpackName}" в выбранном формате.`}
            </p>
          </div>

          <Select
            label={t('modpacks.export_format') || 'Формат экспорта'}
            value={format}
            onChange={(e) => {
              const newFormat = e.target.value as ExportFormat;
              setFormat(newFormat);
              const nextOutputPath = buildDefaultOutputPath(newFormat);
              lastAutoOutputPathRef.current = nextOutputPath;
              setOutputPath(nextOutputPath);
            }}
          >
            <option value="multimc">{t('modpacks.export_format_multimc') || 'MultiMC / Prism Launcher / FriendLauncher (.zip)'}</option>
            <option value="zip">{t('modpacks.export_format_zip') || 'Raw ZIP Archive (Instance Copy)'}</option>
            <option value="modrinth">{t('modpacks.export_format_modrinth') || 'Modrinth (.mrpack) - Manifest Only'}</option>
            <option value="curseforge">{t('modpacks.export_format_curseforge') || 'CurseForge (.zip) - Manifest Only'}</option>
          </Select>

          {(format === 'multimc' || format === 'zip') && (
            <div className="surface-card space-y-3 p-4">
              <h4 className="mb-2 text-sm font-semibold text-foreground">
                {t('modpacks.export_options') || 'Опции экспорта'}
              </h4>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeSaves"
                  checked={includeSaves}
                  onChange={e => setIncludeSaves(e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="includeSaves" className="cursor-pointer select-none text-sm text-secondary">
                  {t('modpacks.include_saves') || 'Включить сохранения миров (saves)'}
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeScreenshots"
                  checked={includeScreenshots}
                  onChange={e => setIncludeScreenshots(e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="includeScreenshots" className="cursor-pointer select-none text-sm text-secondary">
                  {t('modpacks.include_screenshots') || 'Включить скриншоты'}
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeResourcePacks"
                  checked={includeResourcePacks}
                  onChange={e => setIncludeResourcePacks(e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="includeResourcePacks" className="cursor-pointer select-none text-sm text-secondary">
                  {t('modpacks.include_resourcepacks') || 'Включить ресурспаки'}
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeShaders"
                  checked={includeShaders}
                  onChange={e => setIncludeShaders(e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="includeShaders" className="cursor-pointer select-none text-sm text-secondary">
                  {t('modpacks.include_shaders') || 'Включить шейдеры'}
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeMods"
                  checked={includeMods}
                  onChange={e => setIncludeMods(e.target.checked)}
                  className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="includeMods" className="cursor-pointer select-none text-sm text-secondary">
                  {t('modpacks.include_mods') || 'Включить моды (JAR файлы)'}
                </label>
              </div>

            </div>
          )}

          <div>
            <Input
              label={t('modpacks.output_path') || 'Путь для сохранения'}
              value={outputPath}
              onChange={(e) => {
                const value = e.target.value;
                setOutputPath(value);
                setOutputPathError(validateOutputPath(value));
                setError(null);
              }}
              onBlur={(e) => {
                setOutputPathError(validateOutputPath(e.target.value));
              }}
              placeholder={t('modpacks.output_path_placeholder') || 'Выберите путь...'}
              error={outputPathError || undefined}
              required
              containerClassName="mb-0"
            />
            <div className="flex gap-2 mt-2">
              <Button
                variant="secondary"
                onClick={handleSelectPath}
                size="sm"
                className="flex-1"
              >
                {t('settings.browse')}
              </Button>
            </div>
          </div>

          {error && !outputPathError && (
            <ErrorMessage message={error} />
          )}

          <div className="surface-inline flex gap-2 pt-4">
            <Button
              variant="primary"
              onClick={handleExport}
              disabled={exporting || !outputPath.trim() || !!outputPathError}
              className="flex-1"
              style={getAccentStyles('bg').style}
              isLoading={exporting}
            >
              {exporting ? t('modpacks.exporting') || 'Экспорт...' : t('modpacks.export')}
            </Button>
            <Button variant="secondary" onClick={onBack} disabled={exporting}>
              {t('general.cancel')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
