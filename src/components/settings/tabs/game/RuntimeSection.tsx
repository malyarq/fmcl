import React, { useEffect, useState } from 'react';

import { Button } from '../../../ui/Button';
import { Select } from '../../../ui/Select';
import { cn } from '../../../../utils/cn';
import type { ModpackConfig } from '../../../../contexts/instances/types';
import { javaRuntimeIPC } from '../../../../services/ipc/javaRuntimeIPC';
import type { JavaRuntimeInstallationDto } from '@shared/contracts';
import { getRequiredJavaForMinecraftVersion } from '@shared/minecraftRuntime';

// Helper to get RAM in GB
const getRamGb = (config: ModpackConfig | null, defaultVal: number): number => {
  if (!config?.memory?.maxMb) return defaultVal;
  return config.memory.maxMb / 1024;
};

const getMinRamGb = (config: ModpackConfig | null, defaultVal: number): number => {
  if (!config?.memory?.minMb) return defaultVal;
  return config.memory.minMb / 1024;
};

function translateWithFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

export function RuntimeSection(props: {
  modpackConfig: ModpackConfig | null;
  setMemoryGb: (gb: number) => void;
  setMinMemoryGb: (gb: number) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
  isReadOnly?: boolean;
}) {
  const { modpackConfig, setMemoryGb, setMinMemoryGb, t, getAccentStyles, isReadOnly = false } = props;
  const [detectedJavas, setDetectedJavas] = useState<readonly JavaRuntimeInstallationDto[]>([]);
  const [selectedInstallationId, setSelectedInstallationId] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load Detected Javas on mount or scan
  const scanJava = async () => {
    setIsScanning(true);
    try {
      const result = await javaRuntimeIPC.scan();
      setDetectedJavas(result);
      setSelectedInstallationId((current) => result.some((java) => java.id === current) ? current : null);
    } catch (err) {
      console.error('Failed to scan Java:', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    void scanJava();
  }, []);

  useEffect(() => {
    if (isReadOnly) {
      setShowAdvanced(true);
    }
  }, [isReadOnly]);

  const selectedJava = detectedJavas.find((java) => java.id === selectedInstallationId);

  const currentRam = getRamGb(modpackConfig, 4);
  const requiredJavaVer = getRequiredJavaForMinecraftVersion(modpackConfig?.runtime?.minecraft ?? '1.16.5');

  // Warnings
  const warnings: string[] = [];

  // 32-bit check
  if (selectedJava?.arch === 'x86' && currentRam > 1.5) {
    warnings.push(
      translateWithFallback(
        t,
        'settings.warning_32bit_java',
        'You are using 32-bit Java with more than 1.5 GB of RAM. This may cause crashes.',
      ),
    );
  }

  // Java version mismatch
  if (selectedJava && selectedJava.majorVersion < requiredJavaVer) {
    warnings.push(
      translateWithFallback(
        t,
        'settings.warning_java_version',
        'Minecraft {{version}} requires Java {{required}} or newer. Selected: Java {{selected}}.',
        {
          version: modpackConfig?.runtime?.minecraft ?? '?',
          required: requiredJavaVer,
          selected: selectedJava.majorVersion,
        },
      ),
    );
  }

  // Low RAM
  if (currentRam < 1.0) {
    warnings.push(
      translateWithFallback(t, 'settings.warning_low_ram', 'Less than 1 GB of RAM is allocated. This may cause lag.'),
    );
  }

  const handleJavaChange = async (installationId: string) => {
    if (!installationId) return;

    try {
      await javaRuntimeIPC.select({ installationId });
      setSelectedInstallationId(installationId);
    } catch (err) {
      console.error('Failed to select Java runtime:', err);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Memory Slider (Max) */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="control-label">
              {translateWithFallback(t, 'settings.ram', 'Allocated Memory (RAM)')}
            </label>
            <span className="text-sm font-mono font-semibold text-foreground">
              {currentRam} GB
            </span>
          </div>

          <div className="flex gap-2 mb-3">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-[10px] h-7 min-h-0 py-0"
              onClick={() => setMemoryGb(2)}
            >
              2 GB
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-[10px] h-7 min-h-0 py-0"
              onClick={() => setMemoryGb(4)}
            >
              4 GB
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-[10px] h-7 min-h-0 py-0"
              onClick={() => setMemoryGb(8)}
            >
              8 GB
            </Button>
          </div>

          <input
            type="range"
            min="1"
            max="16"
            step="0.5"
            value={getRamGb(modpackConfig, 4)}
            onChange={(e) => setMemoryGb(parseFloat(e.target.value))}
            className={cn('w-full', getAccentStyles('accent').className)}
            style={getAccentStyles('accent').style}
          />
          <div className="helper-text flex justify-between text-[10px]">
            <span>1 GB</span>
            <span>8 GB</span>
            <span>16 GB</span>
          </div>
        </div>

        {/* Min Memory Slider (Advanced) */}
        {showAdvanced && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between mb-2">
              <label className="control-label">
                {translateWithFallback(t, 'settings.min_ram', 'Initial Memory (Xms)')}
              </label>
              <span className="text-sm font-mono font-semibold text-foreground">
                {getMinRamGb(modpackConfig, 1)} GB
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max={getRamGb(modpackConfig, 4)}
              step="0.5"
              value={getMinRamGb(modpackConfig, 1)}
              onChange={(e) => setMinMemoryGb(parseFloat(e.target.value))}
              className={cn('w-full', getAccentStyles('accent').className)}
              style={getAccentStyles('accent').style}
            />
            <div className="helper-text flex justify-between text-[10px]">
              <span>0.5 GB</span>
              <span>{getRamGb(modpackConfig, 4)} GB</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isReadOnly ? (
            <p className="text-xs text-secondary">
              {translateWithFallback(
                t,
                'settings.runtime_locked',
                'Launch is in progress. These settings stay visible for reference and unlock when the current run finishes.',
              )}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs text-muted underline transition-colors hover:text-foreground"
            >
              {showAdvanced
                ? translateWithFallback(t, 'general.hide_advanced', 'Hide advanced')
                : translateWithFallback(t, 'general.show_advanced', 'Show advanced')}
            </button>
          )}
        </div>

        {/* Warnings Area */}
        {warnings.length > 0 && (
          <div className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                <span>⚠️</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Java Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label className="control-label">
              {translateWithFallback(t, 'settings.java_runtime', 'Java runtime')}
            </label>
            <Button size="sm" variant="ghost" onClick={scanJava} disabled={isScanning || isReadOnly}>
              {isScanning
                ? translateWithFallback(t, 'general.scanning', 'Scanning...')
                : translateWithFallback(t, 'general.rescan', 'Rescan')}
            </Button>
          </div>

          <Select
            value={selectedInstallationId ?? ''}
            onChange={(e) => void handleJavaChange(e.target.value)}
            disabled={isScanning || isReadOnly}
          >
            <option value="" disabled>{translateWithFallback(t, 'settings.java_auto', 'Select a detected runtime')}</option>
            {detectedJavas.map((java) => (
              <option key={java.id} value={java.id}>
                Java {java.majorVersion} ({java.version}){java.arch ? ` [${java.arch}]` : ''}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </>
  );
}
