import React, { useEffect, useState } from 'react';

import { Input } from '../../../ui/Input';
import { Button } from '../../../ui/Button';
import { cn } from '../../../../utils/cn';
import type { ModpackConfig } from '../../../../contexts/ModpackContext';
import { modpacksIPC } from '../../../../services/ipc/modpacksIPC';

// Type from shared/contracts/modpacks.ts, duplicated here for now or ideally imported if shared is available
type DetectedJava = {
  path: string;
  version: string;
  majorVersion: number;
  valid: boolean;
  arch?: string;
};

// Helper to get RAM in GB
const getRamGb = (config: ModpackConfig | null, defaultVal: number): number => {
  if (!config?.memory?.maxMb) return defaultVal;
  return config.memory.maxMb / 1024;
};

const getMinRamGb = (config: ModpackConfig | null, defaultVal: number): number => {
  if (!config?.memory?.minMb) return defaultVal;
  return config.memory.minMb / 1024;
};

const getRequiredJavaVersion = (mcVersion?: string): number => {
  if (!mcVersion) return 8;
  // Semver-ish parsing
  const parts = mcVersion.split('.');
  if (parts.length < 2) return 8;
  const minor = parseInt(parts[1], 10);
  const patch = parts.length > 2 ? parseInt(parts[2], 10) : 0;

  if (minor >= 20 && patch >= 5) return 21; // 1.20.5+ -> Java 21
  if (minor >= 18) return 17; // 1.18+ -> Java 17
  if (minor === 17) return 16; // 1.17 -> Java 16
  return 8; // < 1.17 -> Java 8
};

export function RuntimeSection(props: {
  modpackConfig: ModpackConfig | null;
  setMemoryGb: (gb: number) => void;
  setMinMemoryGb: (gb: number) => void;
  setJavaPath: (path: string) => void;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
}) {
  const { modpackConfig, setMemoryGb, setMinMemoryGb, setJavaPath, t, getAccentStyles } = props;
  const [detectedJavas, setDetectedJavas] = useState<DetectedJava[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Load Detected Javas on mount or scan
  const scanJava = async () => {
    setIsScanning(true);
    try {
      const result = await modpacksIPC.scanJava();
      setDetectedJavas(result);
    } catch (err) {
      console.error('Failed to scan Java:', err);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    void scanJava();
  }, []);

  const currentJavaPath = modpackConfig?.java?.path || '';
  const isCustomJava = currentJavaPath !== '' && !detectedJavas.some(j => j.path === currentJavaPath);

  // Find currently selected Java object if possible
  const selectedJava = detectedJavas.find(j => j.path === currentJavaPath);

  const currentRam = getRamGb(modpackConfig, 4);
  const requiredJavaVer = getRequiredJavaVersion(modpackConfig?.runtime?.minecraft);

  // Warnings
  const warnings: string[] = [];

  // 32-bit check
  if (selectedJava?.arch === 'x86' && currentRam > 1.5) {
    warnings.push(t('settings.warning_32bit_java') || 'You are using 32-bit Java with more than 1.5GB RAM. This may cause crashes.');
  }

  // Java version mismatch
  if (selectedJava && selectedJava.majorVersion < requiredJavaVer) {
    warnings.push(`Minecraft ${modpackConfig?.runtime?.minecraft} requires Java ${requiredJavaVer}+. Selected: Java ${selectedJava.majorVersion}.`);
  }

  // Low RAM
  if (currentRam < 1.0) {
    warnings.push(t('settings.warning_low_ram') || 'Less than 1GB RAM allocated. This may cause lag.');
  }

  const handleJavaChange = (val: string) => {
    if (val === 'auto') {
      setJavaPath('');
    } else if (val === 'custom') {
      // Logic handled by rendering Input when custom is selected,
      // but here we might set a placeholder or keep current if it was already custom
      if (!isCustomJava) setJavaPath('C:/'); // Placeholder or keep previous
    } else {
      setJavaPath(val);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Memory Slider (Max) */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {t('settings.ram') || 'Max Memory (Xmx)'}
            </label>
            <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white">
              {getRamGb(modpackConfig, 4)} GB
            </span>
          </div>

          <div className="flex gap-2 mb-3">
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-[10px] h-7 min-h-0 py-0"
              onClick={() => setMemoryGb(2)}
            >
              Low (2GB)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-[10px] h-7 min-h-0 py-0"
              onClick={() => setMemoryGb(4)}
            >
              Med (4GB)
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-[10px] h-7 min-h-0 py-0"
              onClick={() => setMemoryGb(8)}
            >
              High (8GB)
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
          <div className="flex justify-between text-[10px] text-zinc-400">
            <span>1 GB</span>
            <span>8 GB</span>
            <span>16 GB</span>
          </div>
        </div>

        {/* Min Memory Slider (Advanced) */}
        {showAdvanced && (
          <div className="animate-in fade-in slide-in-from-top-2">
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                {t('settings.min_ram') || 'Initial Memory (Xms)'}
              </label>
              <span className="text-sm font-mono font-bold text-zinc-900 dark:text-white">
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
            <div className="flex justify-between text-[10px] text-zinc-400">
              <span>0.5 GB</span>
              <span>{getRamGb(modpackConfig, 4)} GB</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 underline"
          >
            {showAdvanced ? (t('general.hide_advanced') || 'Hide Advanced') : (t('general.show_advanced') || 'Show Advanced')}
          </button>
        </div>

        {/* Warnings Area */}
        {warnings.length > 0 && (
          <div className="p-3 bg-yellow-100/10 border border-yellow-500/20 rounded-lg space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="text-xs text-yellow-600 dark:text-yellow-400 flex items-start gap-2">
                <span>⚠️</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}

        {/* Java Selection */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              {t('settings.java_path') || 'Java Version'}
            </label>
            <Button size="sm" variant="ghost" onClick={scanJava} disabled={isScanning}>
              {isScanning ? (t('general.scanning') || 'Scanning...') : (t('general.rescan') || 'Rescan')}
            </Button>
          </div>

          <select
            className={cn(
              "w-full rounded-lg border bg-white/50 px-3 py-2 text-sm outline-none transition-all dark:bg-zinc-900/50",
              "border-zinc-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-800 dark:focus:border-indigo-500",
              getAccentStyles('ring').className
            )}
            value={isCustomJava ? 'custom' : (currentJavaPath || 'auto')}
            onChange={(e) => handleJavaChange(e.target.value)}
          >
            <option value="auto">{t('settings.java_auto') || 'Auto (Recommended)'}</option>
            {detectedJavas.map((java) => (
              <option key={java.path} value={java.path}>
                Java {java.majorVersion} ({java.version}){java.arch ? ` [${java.arch}]` : ''} - {java.path}
              </option>
            ))}
            <option value="custom">{t('settings.java_custom') || 'Custom Path...'}</option>
          </select>

          {/* Custom Java Path Input */}
          {(isCustomJava || currentJavaPath === 'custom' || (!currentJavaPath && false)) && (
            <Input
              value={currentJavaPath}
              onChange={(e) => setJavaPath(e.target.value)}
              placeholder="C:/Program Files/Java/..."
              className="mt-2"
            />
          )}
        </div>
      </div>
    </>
  );
}

