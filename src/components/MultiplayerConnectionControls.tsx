import { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useMultiplayer } from '../features/multiplayer/hooks/useMultiplayer';
import { cn } from '../utils/cn';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

export function MultiplayerConnectionControls({ multiplayer }: { multiplayer: ReturnType<typeof useMultiplayer> }) {
  const { t, getAccentStyles } = useSettings();
  const [portError, setPortError] = useState<string | null>(null);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const isUpnp = multiplayer.networkMode === 'xmcl_upnp_host';
  const isLan = multiplayer.networkMode === 'xmcl_lan';
  const isTunnel = multiplayer.networkMode === 'hyperswarm';
  const modePanelId = 'multiplayer-mode-panel';
  const active = isTunnel ? multiplayer.tunnel.state === 'active' : isLan ? multiplayer.lan.state === 'active' : multiplayer.upnp.state === 'active';
  const validatePort = (value: string) => {
    const parsed = Number(value);
    if (!value.trim()) return t('validation.port_required');
    if (!Number.isInteger(parsed)) return t('validation.port_invalid');
    return parsed < 1 || parsed > 65_535 ? t('validation.port_range') : null;
  };
  const validateCode = (value: string) => /^[0-9a-f]{64}$/.test(value.trim()) ? null : t('multiplayer.room_code_exact');
  const status = multiplayer.diagnostic ? t(`multiplayer.diagnostic.${multiplayer.diagnostic.code}`) || multiplayer.diagnostic.message : multiplayer.status;
  const liveStatus = status || (active ? t(isTunnel ? 'multiplayer.room_active' : isLan ? 'multiplayer.lan_broadcast_active' : 'multiplayer.upnp_mapping_active') : '');

  const renderHost = () => <div className="space-y-4">
    {!active && <>
      <Input label={t('multiplayer.lan_port')} value={multiplayer.port} onChange={(event) => { multiplayer.setPort(event.target.value); setPortError(validatePort(event.target.value)); }} onBlur={(event) => setPortError(validatePort(event.target.value))} type="number" min="1" max="65535" className="text-center font-mono" error={portError || undefined} />
      <Button className="w-full" onClick={multiplayer.host} isLoading={multiplayer.isLoading} disabled={Boolean(portError) || !multiplayer.port.trim()}>{t(isTunnel ? 'multiplayer.create_room' : isLan ? 'multiplayer.start_lan_broadcast' : 'multiplayer.map_port')}</Button>
    </>}
    {active && isTunnel && multiplayer.roomCode && <button type="button" onClick={() => multiplayer.copyToClipboard(multiplayer.roomCode)} className={cn('multiplayer-room-code', getAccentStyles('soft-bg').className, getAccentStyles('soft-border').className)}>
      <span className="mb-2 block text-xs font-bold uppercase">{t('multiplayer.room_active')}</span><span className="block break-all font-mono text-xs">{multiplayer.roomCode}</span><span className="mt-2 block text-[10px] opacity-70">{t('multiplayer.click_copy')}</span>
    </button>}
    {active && isLan && <StateCard title={t('multiplayer.lan_broadcast_active')} detail={`UDP · ${multiplayer.port}`} />}
    {active && isUpnp && multiplayer.upnp.mappings.map((mapping) => <StateCard key={mapping.publicPort} title={t('multiplayer.upnp_mapping_active')} detail={`${mapping.externalIp}:${mapping.publicPort} → localhost:${mapping.privatePort}`} />)}
    {active && <StopButton onStop={multiplayer.stop} label={t('multiplayer.stop')} />}
  </div>;

  const renderJoin = () => {
    if (isTunnel) return multiplayer.mappedPort ? <div className="space-y-4"><StateCard title={t('multiplayer.tunnel_established')} detail={`localhost:${multiplayer.mappedPort}`} /><StopButton onStop={multiplayer.stop} label={t('multiplayer.stop')} /></div> : <div className="space-y-4"><Input label={t('multiplayer.room_code')} value={multiplayer.joinCode} onChange={(event) => { multiplayer.setJoinCode(event.target.value); setJoinCodeError(validateCode(event.target.value)); }} onBlur={(event) => setJoinCodeError(validateCode(event.target.value))} className="text-center font-mono text-xs" error={joinCodeError || undefined} /><Button className="w-full" onClick={multiplayer.join} isLoading={multiplayer.isLoading} disabled={Boolean(joinCodeError) || !multiplayer.joinCode.trim()}>{t('multiplayer.join_room')}</Button></div>;
    return multiplayer.lan.state !== 'active' ? <Button className="w-full" onClick={multiplayer.join} isLoading={multiplayer.isLoading}>{t('multiplayer.scan_lan')}</Button> : <div className="space-y-4"><div className="max-h-52 space-y-2 overflow-y-auto" aria-live="polite">{multiplayer.discovered.length === 0 && <p className="py-6 text-center text-sm text-secondary">{t('multiplayer.no_lan_servers')}</p>}{multiplayer.discovered.map((server) => <button key={`${server.address}:${server.port}`} type="button" onClick={() => multiplayer.selectLanServer(server)} className="surface-soft w-full rounded-lg p-3 text-left"><span className="block font-medium">{server.motd}</span><span className="block font-mono text-xs text-secondary">{server.address}:{server.port}</span></button>)}</div><StopButton onStop={multiplayer.stop} label={t('multiplayer.stop')} /></div>;
  };

  return <>
    {!isUpnp && <div className="surface-soft flex rounded-lg p-1" role="tablist" aria-label={t('multiplayer.title')}>{(['host', 'join'] as const).map((mode) => <button type="button" key={mode} onClick={() => multiplayer.setMode(mode)} id={`multiplayer-mode-tab-${mode}`} role="tab" aria-selected={multiplayer.mode === mode} aria-controls={modePanelId} className="multiplayer-mode-tab" style={{ outlineColor: '#fff' }}>{t(`multiplayer.${mode}`)}</button>)}</div>}
    <div id={modePanelId} role={isUpnp ? undefined : 'tabpanel'} aria-labelledby={isUpnp ? undefined : `multiplayer-mode-tab-${multiplayer.mode}`} className="space-y-4">
      <p className="text-center text-sm whitespace-pre-line text-secondary">{t(isTunnel ? (multiplayer.mode === 'host' ? 'multiplayer.host_desc' : 'multiplayer.join_desc') : isLan ? 'multiplayer.lan_desc' : 'multiplayer.upnp_desc')}</p>
      {multiplayer.mode === 'host' || isUpnp ? renderHost() : renderJoin()}
    </div>
    {liveStatus && <p role="status" className="multiplayer-live-status">{liveStatus}</p>}
  </>;
}

function StopButton({ onStop, label }: { onStop: () => Promise<void>; label: string }) {
  return <Button variant="danger" onClick={onStop} className="w-full">{label}</Button>;
}

function StateCard({ title, detail }: { title: string; detail: string }) {
  return <div className="surface-soft rounded-xl border p-4 text-center"><p className="mb-2 text-xs font-bold uppercase">{title}</p><p className="break-all font-mono text-sm font-bold">{detail}</p></div>;
}
