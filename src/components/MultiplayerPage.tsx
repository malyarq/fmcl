import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useMultiplayer } from '../features/multiplayer/hooks/useMultiplayer';
import { cn } from '../utils/cn';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';

export interface MultiplayerPageProps { onBack: () => void; }

const MultiplayerPage: React.FC<MultiplayerPageProps> = ({ onBack }) => {
  const { t, getAccentStyles } = useSettings();
  const multiplayer = useMultiplayer();
  const [portError, setPortError] = useState<string | null>(null);
  const [joinCodeError, setJoinCodeError] = useState<string | null>(null);
  const isUpnp = multiplayer.networkMode === 'xmcl_upnp_host';
  const isLan = multiplayer.networkMode === 'xmcl_lan';
  const isTunnel = multiplayer.networkMode === 'hyperswarm';
  const active = isTunnel ? multiplayer.tunnel.state === 'active' : isLan ? multiplayer.lan.state === 'active' : multiplayer.upnp.state === 'active';

  const validatePort = (value: string): string | null => {
    const parsed = Number(value);
    if (!value.trim()) return t('validation.port_required');
    if (!Number.isInteger(parsed)) return t('validation.port_invalid');
    if (parsed < 1 || parsed > 65_535) return t('validation.port_range');
    return null;
  };
  const validateCode = (value: string): string | null => /^[0-9a-f]{64}$/.test(value.trim()) ? null : t('multiplayer.room_code_exact');
  const status = multiplayer.diagnostic
    ? t(`multiplayer.diagnostic.${multiplayer.diagnostic.code}`) || multiplayer.diagnostic.message
    : multiplayer.status;

  return (
    <Modal isOpen onClose={onBack} title={t('multiplayer.title')} className="max-w-lg">
      <div className="flex flex-col gap-5">
        <Select
          label={t('settings.network_mode')}
          description={t('settings.network_mode_desc')}
          value={multiplayer.networkMode}
          onChange={(event) => multiplayer.setNetworkMode(event.target.value as typeof multiplayer.networkMode)}
        >
          <option value="hyperswarm">{t('settings.network_mode_hyperswarm')}</option>
          <option value="xmcl_lan">{t('settings.network_mode_xmcl_lan')}</option>
          <option value="xmcl_upnp_host">{t('settings.network_mode_xmcl_upnp_host')}</option>
        </Select>

        {!isUpnp && (
          <div className="surface-soft flex rounded-lg p-1" role="tablist" aria-label={t('multiplayer.title')}>
            {(['host', 'join'] as const).map((mode) => (
              <button
                type="button"
                key={mode}
                onClick={() => multiplayer.setMode(mode)}
                role="tab"
                aria-selected={multiplayer.mode === mode}
                className={cn(
                  'flex-1 rounded-md py-2 text-sm font-bold uppercase transition-all',
                  multiplayer.mode === mode ? cn('shadow-md text-[rgb(var(--accent-content))]', getAccentStyles('bg').className) : 'text-secondary hover:text-foreground',
                )}
                style={multiplayer.mode === mode ? getAccentStyles('bg').style : undefined}
              >
                {t(`multiplayer.${mode}`)}
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-sm whitespace-pre-line text-secondary">
          {t(isTunnel ? (multiplayer.mode === 'host' ? 'multiplayer.host_desc' : 'multiplayer.join_desc') : isLan ? 'multiplayer.lan_desc' : 'multiplayer.upnp_desc')}
        </p>

        {(multiplayer.mode === 'host' || isUpnp) ? (
          <div className="space-y-4">
            {!active && (
              <>
                <Input
                  label={t('multiplayer.lan_port')}
                  value={multiplayer.port}
                  onChange={(event) => { multiplayer.setPort(event.target.value); setPortError(validatePort(event.target.value)); }}
                  onBlur={(event) => setPortError(validatePort(event.target.value))}
                  type="number"
                  min="1"
                  max="65535"
                  className="text-center font-mono"
                  error={portError || undefined}
                />
                <Button className="w-full" onClick={multiplayer.host} isLoading={multiplayer.isLoading} disabled={Boolean(portError) || !multiplayer.port.trim()}>
                  {t(isTunnel ? 'multiplayer.create_room' : isLan ? 'multiplayer.start_lan_broadcast' : 'multiplayer.map_port')}
                </Button>
              </>
            )}

            {active && isTunnel && multiplayer.roomCode && (
              <button
                type="button"
                onClick={() => multiplayer.copyToClipboard(multiplayer.roomCode)}
                className={cn('w-full rounded-xl border p-4 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-primary))]', getAccentStyles('soft-bg').className, getAccentStyles('soft-border').className)}
              >
                <span className="mb-2 block text-xs font-bold uppercase">{t('multiplayer.room_active')}</span>
                <span className="block break-all font-mono text-xs">{multiplayer.roomCode}</span>
                <span className="mt-2 block text-[10px] opacity-70">{t('multiplayer.click_copy')}</span>
              </button>
            )}
            {active && isLan && <StateCard title={t('multiplayer.lan_broadcast_active')} detail={`UDP · ${multiplayer.port}`} />}
            {active && isUpnp && multiplayer.upnp.mappings.map((mapping) => (
              <StateCard key={mapping.publicPort} title={t('multiplayer.upnp_mapping_active')} detail={`${mapping.externalIp}:${mapping.publicPort} → localhost:${mapping.privatePort}`} />
            ))}
            {active && <Button variant="danger" onClick={multiplayer.stop} className="w-full">{t('multiplayer.stop')}</Button>}
          </div>
        ) : (
          <div className="space-y-4">
            {isTunnel ? (
              !multiplayer.mappedPort ? (
                <>
                  <Input
                    label={t('multiplayer.room_code')}
                    value={multiplayer.joinCode}
                    onChange={(event) => { multiplayer.setJoinCode(event.target.value); setJoinCodeError(validateCode(event.target.value)); }}
                    onBlur={(event) => setJoinCodeError(validateCode(event.target.value))}
                    className="text-center font-mono text-xs"
                    error={joinCodeError || undefined}
                  />
                  <Button className="w-full" onClick={multiplayer.join} isLoading={multiplayer.isLoading} disabled={Boolean(joinCodeError) || !multiplayer.joinCode.trim()}>{t('multiplayer.join_room')}</Button>
                </>
              ) : (
                <>
                  <StateCard title={t('multiplayer.tunnel_established')} detail={`localhost:${multiplayer.mappedPort}`} />
                  <Button variant="danger" onClick={multiplayer.stop} className="w-full">{t('multiplayer.stop')}</Button>
                </>
              )
            ) : (
              <>
                {multiplayer.lan.state !== 'active' ? (
                  <Button className="w-full" onClick={multiplayer.join} isLoading={multiplayer.isLoading}>{t('multiplayer.scan_lan')}</Button>
                ) : (
                  <>
                    <div className="max-h-52 space-y-2 overflow-y-auto" aria-live="polite">
                      {multiplayer.discovered.length === 0 && <p className="py-6 text-center text-sm text-secondary">{t('multiplayer.no_lan_servers')}</p>}
                      {multiplayer.discovered.map((server) => (
                        <button key={`${server.address}:${server.port}`} type="button" onClick={() => multiplayer.selectLanServer(server)} className="surface-soft w-full rounded-lg p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-primary))]">
                          <span className="block font-medium">{server.motd}</span>
                          <span className="block font-mono text-xs text-secondary">{server.address}:{server.port}</span>
                        </button>
                      ))}
                    </div>
                    <Button variant="danger" onClick={multiplayer.stop} className="w-full">{t('multiplayer.stop')}</Button>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {status && <p role="status" className="text-center text-xs font-medium text-amber-700 dark:text-amber-300">{status}</p>}
      </div>
    </Modal>
  );
};

function StateCard({ title, detail }: { title: string; detail: string }) {
  return <div className="surface-soft rounded-xl border p-4 text-center"><p className="mb-2 text-xs font-bold uppercase">{title}</p><p className="break-all font-mono text-sm font-bold">{detail}</p></div>;
}

export default MultiplayerPage;
