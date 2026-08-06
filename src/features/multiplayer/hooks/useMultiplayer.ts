import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  FriendTunnelSnapshot,
  LanDiscoverEvent,
  LanDiscoverySnapshot,
  PortMappingSnapshot,
} from '../../../../shared/contracts/network';
import { useSettings } from '../../../contexts/SettingsContext';
import { networkIPC } from '../../../services/ipc/networkIPC';
import { useEffectiveInstance } from '../../instances/hooks/useEffectiveInstance';
import { analyticsClient } from '../../analytics/analyticsClient';
import { dispatchInstanceConfigCommand, useInstanceConfigCommands } from '../../instances/hooks/useInstanceConfigCommands';
import {
  clearLegacySessionTruth, loadHostPort, loadJoinCode, loadMode, saveHostPort, saveJoinCode, saveMode, type Mode,
} from '../services/multiplayerPersistence';
import {
  createFriendTunnelInvite,
  normalizeFriendTunnelInvite,
} from '../services/friendTunnelInvite';

type NetworkMode = 'hyperswarm' | 'xmcl_lan' | 'xmcl_upnp_host';

const TUNNEL_IDLE: FriendTunnelSnapshot = { revision: 0, state: 'idle', role: null, peerCount: 0 };
const LAN_IDLE: LanDiscoverySnapshot = { revision: 0, state: 'idle', family: null, discoveredCount: 0 };
const UPNP_IDLE: PortMappingSnapshot = { revision: 0, state: 'idle', mappings: [] };

export function useMultiplayer() {
  const { t } = useSettings();
  const effectiveInstance = useEffectiveInstance();
  const instance = effectiveInstance.status === 'ready' ? effectiveInstance.data.snapshot : null;
  const commands = useInstanceConfigCommands(effectiveInstance.status === 'ready' ? effectiveInstance.data.id : null);
  const [mode, setMode] = useState<Mode>(() => loadMode());
  const [port, setPort] = useState(() => String(instance?.server?.port || loadHostPort('25565')));
  const [joinCode, setJoinCode] = useState(() => loadJoinCode());
  const [tunnel, setTunnel] = useState(TUNNEL_IDLE);
  const [lan, setLan] = useState(LAN_IDLE);
  const [upnp, setUpnp] = useState(UPNP_IDLE);
  const [discovered, setDiscovered] = useState<LanDiscoverEvent[]>([]);
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const connectedSession = useRef<string | null>(null);
  const networkMode = (instance?.networkMode || 'hyperswarm') as NetworkMode;

  useEffect(() => { clearLegacySessionTruth(); }, []);
  useEffect(() => { saveMode(mode); }, [mode]);
  useEffect(() => { saveHostPort(port); }, [port]);
  useEffect(() => { saveJoinCode(joinCode); }, [joinCode]);
  useEffect(() => {
    const next = instance?.server?.port;
    if (next && Number.isFinite(next)) setPort(String(next));
  }, [instance?.id, instance?.server?.port]);
  useEffect(() => { if (networkMode === 'xmcl_upnp_host' && mode === 'join') setMode('host'); }, [mode, networkMode]);

  useEffect(() => {
    if (!networkIPC.isAvailable()) return;
    let alive = true;
    void Promise.all([
      networkIPC.tunnel.getState(), networkIPC.lan.getState(), networkIPC.upnp.getState(),
    ]).then(([nextTunnel, nextLan, nextUpnp]) => {
      if (alive) { setTunnel(nextTunnel); setLan(nextLan); setUpnp(nextUpnp); }
    }).catch(() => { if (alive) setStatus(t('multiplayer.network_unavailable')); });
    const unsubscribers = [
      networkIPC.tunnel.onState(setTunnel),
      networkIPC.lan.onState(setLan),
      networkIPC.upnp.onState(setUpnp),
      networkIPC.lan.onDiscover((event) => setDiscovered((current) => {
        const withoutDuplicate = current.filter((item) => item.address !== event.address || item.port !== event.port);
        return [...withoutDuplicate, event].slice(-50);
      })),
    ];
    return () => { alive = false; unsubscribers.forEach((unsubscribe) => unsubscribe()); };
  }, [t]);

  const activeSnapshot = useMemo(() => networkMode === 'hyperswarm' ? tunnel : networkMode === 'xmcl_lan' ? lan : upnp, [lan, networkMode, tunnel, upnp]);
  const diagnostic = activeSnapshot.diagnostic;
  const roomCode = tunnel.state === 'active' && tunnel.role === 'host' ? tunnel.roomCode || '' : '';
  const mappedPort = tunnel.state === 'active' && tunnel.role === 'join' ? tunnel.localPort || null : null;
  const invitation = roomCode ? createFriendTunnelInvite(roomCode) : '';
  const directAddress = mappedPort ? `localhost:${mappedPort}` : '';

  useEffect(() => {
    if (tunnel.state !== 'active' || !tunnel.role || tunnel.peerCount < 1) {
      if (tunnel.state === 'idle') connectedSession.current = null;
      return;
    }
    const session = `${tunnel.role}:${tunnel.roomCode ?? ''}`;
    if (connectedSession.current === session) return;
    connectedSession.current = session;
    void analyticsClient.capture('friend_tunnel_peer_connected', { role: tunnel.role });
  }, [tunnel]);

  const persistServer = async (host: string, serverPort: number) => await commands.patchConfig({ server: { host, port: serverPort } });
  const run = async (work: () => Promise<void>) => {
    if (!networkIPC.isAvailable()) { setStatus(t('multiplayer.network_unavailable')); return; }
    setIsLoading(true); setStatus('');
    try { await work(); }
    catch (error) { setStatus(error instanceof Error ? error.message : t('multiplayer.network_unavailable')); }
    finally { setIsLoading(false); }
  };

  const host = async () => await run(async () => {
    const hostPort = Number.parseInt(port, 10) || 25_565;
    await persistServer('localhost', hostPort);
    if (networkMode === 'hyperswarm') {
      try {
        const result = await networkIPC.tunnel.host({ port: hostPort });
        if (result.state === 'active') void analyticsClient.capture('friend_tunnel_started', { role: 'host' });
        else void analyticsClient.capture('friend_tunnel_failed', { role: 'host', failure_stage: 'start' });
      } catch (error) {
        void analyticsClient.capture('friend_tunnel_failed', { role: 'host', failure_stage: 'start' });
        throw error;
      }
    }
    else if (networkMode === 'xmcl_lan') {
      await networkIPC.lan.start({ family: 'udp4' });
      await networkIPC.lan.broadcast({ motd: instance?.name || 'FriendLauncher', port: hostPort });
    } else await networkIPC.upnp.mapTcp({ publicPort: hostPort, privatePort: hostPort });
  });

  const join = async () => await run(async () => {
    if (networkMode === 'hyperswarm') {
      const normalizedCode = normalizeFriendTunnelInvite(joinCode);
      if (!normalizedCode) throw new Error(t('multiplayer.room_code_invalid'));
      try {
        const result = await networkIPC.tunnel.join({ roomCode: normalizedCode });
        if (result.state === 'active' && result.localPort) {
          setJoinCode(normalizedCode);
          await persistServer('localhost', result.localPort);
          void analyticsClient.capture('friend_tunnel_started', { role: 'join' });
        } else {
          void analyticsClient.capture('friend_tunnel_failed', { role: 'join', failure_stage: 'start' });
        }
      } catch (error) {
        void analyticsClient.capture('friend_tunnel_failed', { role: 'join', failure_stage: 'start' });
        throw error;
      }
    } else if (networkMode === 'xmcl_lan') {
      setDiscovered([]);
      await networkIPC.lan.start({ family: 'udp4' });
    }
  });

  const selectLanServer = async (server: LanDiscoverEvent) => await run(async () => {
    const result = await networkIPC.lan.ping({ host: server.address, port: server.port });
    if (result.status === 'failed') { setStatus(t(`multiplayer.diagnostic.${result.diagnostic.code}`)); return; }
    await persistServer(server.address, server.port);
    setStatus(`${result.server.versionName} · ${result.server.onlinePlayers}/${result.server.maxPlayers} · ${result.server.latencyMs} ms`);
  });
  const stop = async () => await run(async () => {
    if (networkMode === 'hyperswarm') await networkIPC.tunnel.stop();
    else if (networkMode === 'xmcl_lan') { await networkIPC.lan.stop(); setDiscovered([]); }
    else await networkIPC.upnp.stop();
  });
  const setNetworkMode = (next: NetworkMode) => dispatchInstanceConfigCommand(commands.setNetworkMode(next));
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(t('general.copied'));
    } catch {
      setStatus(t('multiplayer.copy_failed'));
    }
  };

  return {
    mode, setMode, port, setPort, roomCode, invitation, joinCode, setJoinCode, mappedPort, directAddress,
    status, diagnostic, isLoading, networkMode, setNetworkMode, tunnel, lan, upnp, discovered,
    host, join, stop, selectLanServer, copyToClipboard,
  };
}
