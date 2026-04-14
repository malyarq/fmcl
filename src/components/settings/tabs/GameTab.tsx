import React, { useEffect, useState } from 'react';
import { ModpackConfig } from '../../../contexts/ModpackContext';
import { formatArgs, parseArgs } from '../utils/argParser';
import { RuntimeSection } from './game/RuntimeSection';
import { ResolutionSection } from './game/ResolutionSection';
import { ArgsSection } from './game/ArgsSection';
import { AutoConnectSection } from './game/AutoConnectSection';

export interface GameTabProps {
  modpackConfig: ModpackConfig | null;
  setMemoryGb: (gb: number) => void;
  setMinMemoryGb: (gb: number) => void;
  setJavaPath: (path: string) => void;
  setVmOptions: (vmOptions: string[]) => void;
  setGameExtraArgs: (args: string[]) => void;
  setGameResolution: (resolution?: { width?: number; height?: number; fullscreen?: boolean }) => void;
  setAutoConnectServer: (server?: { host: string; port: number }) => void;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg' | 'text' | 'border' | 'ring' | 'hover' | 'accent' | 'title' | 'soft-bg' | 'soft-border') => {
    className?: string;
    style?: React.CSSProperties;
  };
}

export const GameTab: React.FC<GameTabProps> = ({
  modpackConfig,
  setMemoryGb,
  setMinMemoryGb,
  setJavaPath,
  setVmOptions,
  setGameExtraArgs,
  setGameResolution,
  setAutoConnectServer,
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
      <div className="surface-soft space-y-3 p-3 sm:p-4">
        <div className="control-label">
          {t('settings.tab_game')}
        </div>

        <RuntimeSection
          modpackConfig={modpackConfig}
          setMemoryGb={setMemoryGb}
          setMinMemoryGb={setMinMemoryGb}
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
    </div>
  );
};
