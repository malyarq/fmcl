import { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { useModpack } from '../../../contexts/ModpackContext';
import { hostRoom, isNetworkAvailable, joinRoom, stopSession } from '../services/multiplayerService';
import {
  loadHostPort,
  loadJoinCode,
  loadMappedPort,
  loadMode,
  loadRoomCode,
  saveHostPort,
  saveJoinCode,
  saveMappedPort,
  saveMode,
  saveRoomCode,
  type Mode,
} from '../services/multiplayerPersistence';

type NetworkMode = 'hyperswarm' | 'xmcl_lan' | 'xmcl_upnp_host';

export type UseMultiplayerResult = {
  mode: Mode;
  setMode: (mode: Mode) => void;

  port: string;
  setPort: (port: string) => void;

  roomCode: string;
  joinCode: string;
  setJoinCode: (code: string) => void;

  mappedPort: number | null;

  status: string;
  isLoading: boolean;

  networkMode: NetworkMode;
  setNetworkMode: (mode: NetworkMode) => void;

  host: () => Promise<void>;
  join: () => Promise<void>;
  stop: () => Promise<void>;

  copyToClipboard: (text: string) => void;
};

export function useMultiplayer(): UseMultiplayerResult {
  const { t } = useSettings();
  const { config: modpackConfig, patchConfig, setNetworkMode: setModpackNetworkMode } = useModpack();

  const [mode, setMode] = useState<Mode>(() => loadMode());

  const [port, setPort] = useState(() => {
    const fromModpack = modpackConfig?.server?.port;
    if (typeof fromModpack === 'number' && Number.isFinite(fromModpack) && fromModpack > 0) return String(fromModpack);
    return loadHostPort('25565');
  });

  const [roomCode, setRoomCode] = useState(() => loadRoomCode());
  const [joinCode, setJoinCode] = useState(() => loadJoinCode());

  const [mappedPort, setMappedPort] = useState<number | null>(() => loadMappedPort());

  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const networkMode = useMemo(() => {
    return (modpackConfig?.networkMode || 'hyperswarm') as NetworkMode;
  }, [modpackConfig?.networkMode]);

  useEffect(() => {
    saveMode(mode);
  }, [mode]);

  useEffect(() => {
    saveHostPort(port);
  }, [port]);

  // When selected modpack changes, adopt its configured server port (if any).
  useEffect(() => {
    const p = modpackConfig?.server?.port;
    if (typeof p === 'number' && Number.isFinite(p) && p > 0) {
      setPort(String(p));
    }
  }, [modpackConfig?.id, modpackConfig?.server?.port]);

  useEffect(() => {
    saveJoinCode(joinCode);
  }, [joinCode]);

  useEffect(() => {
    saveRoomCode(roomCode);
  }, [roomCode]);

  useEffect(() => {
    saveMappedPort(mappedPort);
  }, [mappedPort]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setStatus(t('general.copied'));
    setTimeout(() => setStatus(''), 2000);
  };

  const host = async () => {
    if (!isNetworkAvailable()) {
      setStatus('Error: Network API not loaded.');
      return;
    }
    setIsLoading(true);
    setStatus(t('multiplayer.publishing'));
    try {
      const hostPort = parseInt(port) || 25565;
      // Bind host port to selected modpack config.
      patchConfig({ server: { host: 'localhost', port: hostPort } });
      const code = await hostRoom(hostPort);
      setRoomCode(code);
      setMappedPort(null);
      setStatus(t('multiplayer.room_active'));
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setStatus(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const join = async () => {
    if (!isNetworkAvailable()) {
      setStatus('Error: Network API not loaded.');
      return;
    }
    setIsLoading(true);
    setStatus(t('multiplayer.joining'));
    try {
      const localPort = await joinRoom(joinCode);
      setMappedPort(localPort);
      setRoomCode('');
      // Bind resulting tunnel endpoint to selected modpack config for convenience.
      patchConfig({ server: { host: 'localhost', port: localPort } });
      setStatus(`${t('multiplayer.tunnel_established')} localhost:${localPort}`);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setStatus(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const stop = async () => {
    await stopSession();
    setRoomCode('');
    setMappedPort(null);
    setStatus(t('multiplayer.session_stopped'));
  };

  const setNetworkMode = (next: NetworkMode) => {
    setModpackNetworkMode(next);
  };

  return {
    mode,
    setMode,
    port,
    setPort,
    roomCode,
    joinCode,
    setJoinCode,
    mappedPort,
    status,
    isLoading,
    networkMode,
    setNetworkMode,
    host,
    join,
    stop,
    copyToClipboard,
  };
}

