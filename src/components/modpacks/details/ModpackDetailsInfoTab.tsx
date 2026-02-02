import React from 'react';
import { Button } from '../../ui/Button';
import type { ModpackMetadata } from '@shared/types/modpack';

export interface ModpackDetailsInfoTabProps {
  descriptionDraft: string;
  onDescriptionChange: (value: string) => void;
  onSaveDescription: () => void;
  metadata: ModpackMetadata | null;
  t: (key: string) => string;
}

export const ModpackDetailsInfoTab: React.FC<ModpackDetailsInfoTabProps> = ({
  descriptionDraft,
  onDescriptionChange,
  onSaveDescription,
  metadata,
  t,
}) => (
  <div className="space-y-4">
    <div>
      <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
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
      <div className="flex justify-end mt-2">
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
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">
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
  </div>
);
