import React from 'react';
import { Button } from '../../ui/Button';
import type { ModpackMetadata } from '@shared/types/modpack';
import { ModpackDependencySummary } from '../../sidebar/ModpackDependencySummary';
import {
  getModpackRuntimeSourceDescription,
  type ModpackRuntimeSummary,
} from '../../../features/modpacks/hooks/useModpackRuntimeSummary';

export interface ModpackDetailsInfoTabProps {
  descriptionDraft: string;
  onDescriptionChange: (value: string) => void;
  onSaveDescription: () => void;
  metadata: ModpackMetadata | null;
  runtimeSummary: ModpackRuntimeSummary;
  t: (key: string) => string;
}

export const ModpackDetailsInfoTab: React.FC<ModpackDetailsInfoTabProps> = ({
  descriptionDraft,
  onDescriptionChange,
  onSaveDescription,
  metadata,
  runtimeSummary,
  t,
}) => (
  <div className="space-y-4">
    <section className="surface-card space-y-4 p-4" data-testid="modpack-details-runtime-panel">
      <div className="space-y-2">
        <div className="kicker-label">{t('sidebar.current_runtime')}</div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            {t('modpacks.runtime_summary_title') === 'modpacks.runtime_summary_title'
              ? 'Runtime and dependency state'
              : t('modpacks.runtime_summary_title')}
          </h3>
          <p className="text-sm leading-6 text-secondary">
            {getModpackRuntimeSourceDescription(runtimeSummary.source, t)}
          </p>
        </div>
      </div>

      <ModpackDependencySummary runtime={runtimeSummary.runtime} status={runtimeSummary.status} t={t} />
    </section>

    <section className="surface-card space-y-4 p-4">
      <div>
        <h4 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
          {t('modpacks.description')}
        </h4>
        <textarea
          className="w-full min-h-[80px] rounded-md border border-zinc-300 dark:border-zinc-700 bg-white/80 dark:bg-zinc-900/60 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 resize-y focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600"
          value={descriptionDraft}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={
            (() => {
              const raw = t('modpacks.description_placeholder');
              return raw === 'modpacks.description_placeholder' ? 'Кратко опишите модпак' : raw;
            })()
          }
        />
        <div className="mt-2 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onSaveDescription}>
            {(() => {
              const raw = t('general.save');
              return raw === 'general.save' ? 'Сохранить' : raw;
            })()}
          </Button>
        </div>
      </div>
      {metadata?.source && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
            {t('modpacks.source') || 'Источник'}
          </h4>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 capitalize">
            {metadata.source === 'curseforge'
              ? t('modpacks.platform_curseforge')
              : metadata.source === 'modrinth'
                ? t('modpacks.platform_modrinth')
                : t('modpacks.platform_local')}
          </p>
        </div>
      )}
    </section>
  </div>
);
