import React, { useEffect, useState } from 'react';
import { ModpackConfig } from '../../../contexts/ModpackContext';
import { formatArgs, parseArgs } from '../utils/argParser';
import { RuntimeSection } from './game/RuntimeSection';
import { ResolutionSection } from './game/ResolutionSection';
import { ArgsSection } from './game/ArgsSection';
import { AutoConnectSection } from './game/AutoConnectSection';
import { MinecraftPathSection } from './game/MinecraftPathSection';

export interface GameTabProps {
  modpackConfig: ModpackConfig | null;
  setMemoryGb: (gb: number) => void;
  setJavaPath: (path: string) => void;
  setVmOptions: (vmOptions: string[]) => void;
  setGameExtraArgs: (args: string[]) => void;
  setGameResolution: (resolution?: { width?: number; height?: number; fullscreen?: boolean }) => void;
  setAutoConnectServer: (server?: { host: string; port: number }) => void;
  refreshInstances: () => Promise<void>;

  minecraftPath: string;
  setMinecraftPath: (val: string) => void;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
}

export const GameTab: React.FC<GameTabProps> = ({
  modpackConfig,
  setMemoryGb,
  setJavaPath,
  setVmOptions,
  setGameExtraArgs,
  setGameResolution,
  setAutoConnectServer,
  refreshInstances: _refreshInstances,
  minecraftPath,
  setMinecraftPath,
  t,
  getAccentStyles,
}) => {
  const resolution = modpackConfig?.game?.resolution;

  const [widthInput, setWidthInput] = useState<string>('');
  const [heightInput, setHeightInput] = useState<string>('');
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [vmArgsText, setVmArgsText] = useState<string>('');
  const [mcArgsText, setMcArgsText] = useState<string>('');
  const [autoConnect, setAutoConnect] = useState<boolean>(false);
  const [serverHost, setServerHost] = useState<string>('');
  const [serverPort, setServerPort] = useState<string>('');

  useEffect(() => {
    setWidthInput(typeof resolution?.width === 'number' && Number.isFinite(resolution.width) ? String(resolution.width) : '');
    setHeightInput(typeof resolution?.height === 'number' && Number.isFinite(resolution.height) ? String(resolution.height) : '');
    setFullscreen(Boolean(resolution?.fullscreen));
    setVmArgsText(formatArgs(modpackConfig?.vmOptions));
    setMcArgsText(formatArgs(modpackConfig?.game?.extraArgs));
    setAutoConnect(Boolean(modpackConfig?.server?.host));
    setServerHost(modpackConfig?.server?.host || '');
    setServerPort(modpackConfig?.server?.port ? String(modpackConfig.server.port) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modpackConfig?.id]);

  const updateResolutionFromInputs = (params: { widthText: string; heightText: string; fullscreen: boolean }) => {
    const w = params.widthText.trim() ? parseInt(params.widthText, 10) : undefined;
    const h = params.heightText.trim() ? parseInt(params.heightText, 10) : undefined;
    setGameResolution({
      width: Number.isFinite(w as number) && (w as number) > 0 ? (w as number) : undefined,
      height: Number.isFinite(h as number) && (h as number) > 0 ? (h as number) : undefined,
      fullscreen: params.fullscreen,
    });
  };

  const applyAutoConnect = (params: { enabled: boolean; host: string; portText: string }) => {
    if (!params.enabled) {
      setAutoConnectServer(undefined);
      return;
    }
    const port = parseInt(params.portText || '25565', 10);
    setAutoConnectServer({
      host: (params.host || '127.0.0.1').trim(),
      port: Number.isFinite(port) ? port : 25565,
    });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white/60 dark:bg-zinc-900/40 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-3 space-y-3">
        <div className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {t('settings.tab_game')}
        </div>

        <RuntimeSection
          modpackConfig={modpackConfig}
          setMemoryGb={setMemoryGb}
          setJavaPath={setJavaPath}
          t={t}
          getAccentStyles={getAccentStyles}
        />

        <ResolutionSection
          widthInput={widthInput}
          heightInput={heightInput}
          fullscreen={fullscreen}
          onWidthInputChange={(v) => {
            setWidthInput(v);
            updateResolutionFromInputs({ widthText: v, heightText: heightInput, fullscreen });
          }}
          onHeightInputChange={(v) => {
            setHeightInput(v);
            updateResolutionFromInputs({ widthText: widthInput, heightText: v, fullscreen });
          }}
          onFullscreenChange={(next) => {
            setFullscreen(next);
            updateResolutionFromInputs({ widthText: widthInput, heightText: heightInput, fullscreen: next });
          }}
          t={t}
        />

        <ArgsSection
          vmArgsText={vmArgsText}
          mcArgsText={mcArgsText}
          onVmArgsTextChange={(v) => {
            setVmArgsText(v);
            setVmOptions(parseArgs(v));
          }}
          onMcArgsTextChange={(v) => {
            setMcArgsText(v);
            setGameExtraArgs(parseArgs(v));
          }}
          t={t}
        />

        <AutoConnectSection
          autoConnect={autoConnect}
          serverHost={serverHost}
          serverPort={serverPort}
          setAutoConnect={setAutoConnect}
          setServerHost={setServerHost}
          setServerPort={setServerPort}
          applyAutoConnect={applyAutoConnect}
          t={t}
        />
      </div>

      <MinecraftPathSection minecraftPath={minecraftPath} setMinecraftPath={setMinecraftPath} t={t} />
    </div>
  );
};

