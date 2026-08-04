import { ipcMain, type BrowserWindow } from 'electron';
import { NETWORK_CHANNELS } from '../../../shared/contracts/network';
import type { FriendTunnelService } from '../../services/network/friendTunnelService';
import type { LanDiscoveryService } from '../../services/network/lanDiscoveryService';
import type { PortMappingService } from '../../services/network/portMappingService';
import { validateBoundedString, validateEnum, validateInteger } from '../validation/privilegedPayloads';

function requestObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} must be a plain object`);
  return value as Record<string, unknown>;
}
function exactKeys(record: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const extras = Object.keys(record).filter((key) => !allowed.includes(key));
  if (extras.length) throw new Error(`${label} contains unsupported fields`);
}

function port(value: unknown, label: string): number {
  return validateInteger(value, label, { min: 1, max: 65_535 });
}

export function registerNetworkHandlers(deps: {
  window: BrowserWindow;
  friendTunnel: FriendTunnelService;
  lanDiscovery: LanDiscoveryService;
  portMapping: PortMappingService;
}) {
  const { window, friendTunnel, lanDiscovery, portMapping } = deps;
  const handlers: Array<[string, (...args: unknown[]) => unknown]> = [
    [NETWORK_CHANNELS.tunnelGetState, () => friendTunnel.getState()],
    [NETWORK_CHANNELS.tunnelHost, async (value) => {
      const request = requestObject(value, 'Tunnel host request'); exactKeys(request, ['port'], 'Tunnel host request');
      return await friendTunnel.host(port(request.port, 'LAN port'));
    }],
    [NETWORK_CHANNELS.tunnelJoin, async (value) => {
      const request = requestObject(value, 'Tunnel join request'); exactKeys(request, ['roomCode'], 'Tunnel join request');
      return await friendTunnel.join(validateBoundedString(request.roomCode, 'Room code', { minLength: 64, maxLength: 64 }));
    }],
    [NETWORK_CHANNELS.tunnelStop, async () => await friendTunnel.stop()],
    [NETWORK_CHANNELS.lanGetState, () => lanDiscovery.getState()],
    [NETWORK_CHANNELS.lanStart, async (value) => {
      const request = value === undefined ? {} : requestObject(value, 'LAN start request'); exactKeys(request, ['family'], 'LAN start request');
      const family = request.family === undefined ? 'udp4' : validateEnum(request.family, 'LAN family', ['udp4', 'udp6'] as const);
      return await lanDiscovery.start(family);
    }],
    [NETWORK_CHANNELS.lanStop, async () => await lanDiscovery.stop()],
    [NETWORK_CHANNELS.lanBroadcast, async (value) => {
      const request = requestObject(value, 'LAN broadcast request'); exactKeys(request, ['motd', 'port'], 'LAN broadcast request');
      return await lanDiscovery.broadcast(validateBoundedString(request.motd, 'LAN message', { maxLength: 256 }), port(request.port, 'LAN port'));
    }],
    [NETWORK_CHANNELS.lanPing, async (value) => {
      const request = requestObject(value, 'LAN ping request'); exactKeys(request, ['host', 'port'], 'LAN ping request');
      return await lanDiscovery.ping(
        validateBoundedString(request.host, 'Server host', { maxLength: 253 }),
        request.port === undefined ? 25_565 : port(request.port, 'Server port'),
      );
    }],
    [NETWORK_CHANNELS.upnpGetState, () => portMapping.getState()],
    [NETWORK_CHANNELS.upnpMapTcp, async (value) => {
      const request = requestObject(value, 'UPnP map request'); exactKeys(request, ['publicPort', 'privatePort'], 'UPnP map request');
      return await portMapping.mapTcp(port(request.publicPort, 'Public port'), port(request.privatePort, 'Private port'));
    }],
    [NETWORK_CHANNELS.upnpUnmapTcp, async (value) => {
      const request = requestObject(value, 'UPnP unmap request'); exactKeys(request, ['publicPort'], 'UPnP unmap request');
      return await portMapping.unmapTcp(port(request.publicPort, 'Public port'));
    }],
    [NETWORK_CHANNELS.upnpStop, async () => await portMapping.stop()],
  ];
  for (const [channel, handler] of handlers) {
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (_event, ...args) => await handler(...args));
  }

  const send = (channel: string, value: unknown) => {
    if (!window.isDestroyed()) window.webContents.send(channel, value);
  };
  const unsubscribe = [
    friendTunnel.subscribe((snapshot) => send(NETWORK_CHANNELS.tunnelState, snapshot)),
    lanDiscovery.subscribe((snapshot) => send(NETWORK_CHANNELS.lanState, snapshot)),
    lanDiscovery.onDiscover((event) => send(NETWORK_CHANNELS.lanDiscover, event)),
    portMapping.subscribe((snapshot) => send(NETWORK_CHANNELS.upnpState, snapshot)),
  ];
  window.once('closed', () => unsubscribe.forEach((dispose) => dispose()));
}
