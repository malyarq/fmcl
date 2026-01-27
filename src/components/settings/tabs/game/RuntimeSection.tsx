import React from 'react';
import { Input } from '../../../ui/Input';
import { cn } from '../../../../utils/cn';
import { getInstanceRamGb } from '../../../../contexts/ModpackContext';
import type { ModpackConfig } from '../../../../contexts/ModpackContext';

export function RuntimeSection(props: {
  modpackConfig: ModpackConfig | null;
  setMemoryGb: (gb: number) => void;
  setJavaPath: (path: string) => void;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
}) {
  const { modpackConfig, setMemoryGb, setJavaPath, t, getAccentStyles } = props;

  return (
    <>
      <div className="space-y-3">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            {t('settings.ram')}
          </label>
          <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white">
            {getInstanceRamGb(modpackConfig, 4)} GB
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="16"
          step="0.5"
          value={getInstanceRamGb(modpackConfig, 4)}
          onChange={(e) => setMemoryGb(parseFloat(e.target.value))}
          className={cn('w-full', getAccentStyles('accent').className)}
          style={getAccentStyles('accent').style}
        />
        <div className="flex justify-between text-[10px] text-zinc-400">
          <span>1 GB</span>
          <span>8 GB</span>
          <span>16 GB</span>
        </div>
      </div>

      <Input
        label={t('settings.java_path')}
        value={modpackConfig?.java?.path || ''}
        onChange={(e) => setJavaPath(e.target.value)}
        placeholder="Default (Autodetect)"
      />
    </>
  );
}

