import React, { useState } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { cn } from '../utils/cn';
import { useMultiplayer } from '../features/multiplayer/hooks/useMultiplayer';

interface MultiplayerPageProps {
    onBack: () => void;
}

const MultiplayerPage: React.FC<MultiplayerPageProps> = ({ onBack }) => {
    const { t, getAccentStyles } = useSettings();
    const {
        mode, setMode,
        port, setPort,
        roomCode,
        joinCode, setJoinCode,
        mappedPort,
        status,
        isLoading,
        networkMode, setNetworkMode,
        host, join, stop,
        copyToClipboard,
    } = useMultiplayer();
    const [portError, setPortError] = useState<string | null>(null);
    const [joinCodeError, setJoinCodeError] = useState<string | null>(null);

    const validatePort = (value: string): string | null => {
        if (!value.trim()) {
            return t('validation.port_required') || 'Порт обязателен';
        }
        const portNum = parseInt(value.trim(), 10);
        if (isNaN(portNum)) {
            return t('validation.port_invalid') || 'Порт должен быть числом';
        }
        if (portNum < 1 || portNum > 65535) {
            return t('validation.port_range') || 'Порт должен быть от 1 до 65535';
        }
        return null;
    };

    const validateJoinCode = (value: string): string | null => {
        if (!value.trim()) {
            return t('validation.room_code_required') || 'Код комнаты обязателен';
        }
        if (value.trim().length < 10) {
            return t('validation.room_code_too_short') || 'Код комнаты слишком короткий';
        }
        return null;
    };

    return (
        <Modal
            isOpen={true}
            onClose={onBack}
            title={t('multiplayer.title')}
            className="max-w-md"
        >
            <div className="flex flex-col gap-6">
                {/* Mode Switcher */}
                <div className="surface-soft flex rounded-lg p-1" role="tablist" aria-label={t('multiplayer.title')}>
                    {['host', 'join'].map((m) => (
                        <button
                            type="button"
                            key={m}
                            onClick={() => setMode(m as 'host' | 'join')}
                            role="tab"
                            aria-selected={mode === m}
                            className={cn(
                                "flex-1 py-2 text-sm font-bold uppercase rounded-md transition-all",
                                mode === m
                                    ? cn("shadow-md text-[rgb(var(--accent-content))]", getAccentStyles('bg').className)
                                    : "text-secondary hover:text-foreground"
                            )}
                            style={mode === m ? getAccentStyles('bg').style : undefined}
                        >
                            {t(`multiplayer.${m}`)}
                        </button>
                    ))}
                </div>

                {/* Network mode (per selected instance) */}
                <Select
                    label={t('settings.network_mode')}
                    description={t('settings.network_mode_desc')}
                    value={networkMode}
                    onChange={(e) => setNetworkMode(e.target.value as typeof networkMode)}
                >
                    <option value="hyperswarm">{t('settings.network_mode_hyperswarm')}</option>
                    <option value="xmcl_lan">{t('settings.network_mode_xmcl_lan')}</option>
                    <option value="xmcl_upnp_host">{t('settings.network_mode_xmcl_upnp_host')}</option>
                </Select>

                {/* Content Area */}
                <div className="min-h-[250px] flex flex-col justify-center">
                    {mode === 'host' ? (
                        <div className="space-y-4">
                            <p className="px-4 text-center text-sm whitespace-pre-line text-secondary">
                                {t('multiplayer.host_desc')}
                            </p>

                            {!roomCode ? (
                                <>
                                    <Input
                                        label={t('multiplayer.lan_port')}
                                        value={port}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setPort(value);
                                            setPortError(validatePort(value));
                                        }}
                                        onBlur={(e) => {
                                            setPortError(validatePort(e.target.value));
                                        }}
                                        placeholder="25565"
                                        className="text-center font-mono"
                                        error={portError || undefined}
                                        type="number"
                                        min="1"
                                        max="65535"
                                    />
                                    <Button 
                                        onClick={host} 
                                        isLoading={isLoading} 
                                        className="w-full"
                                        disabled={!!portError || !port.trim()}
                                    >
                                        {t('multiplayer.create_room')}
                                    </Button>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <button
                                        type="button"
                                        onClick={() => copyToClipboard(roomCode)}
                                        aria-label={t('multiplayer.click_copy')}
                                        className={cn(
                                            "w-full border rounded-xl p-4 text-center cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-primary))]",
                                            getAccentStyles('soft-bg').className,
                                            getAccentStyles('soft-border').className
                                        )}
                                        style={{
                                            ...getAccentStyles('soft-bg').style,
                                            ...getAccentStyles('soft-border').style
                                        }}
                                    >
                                        <p className={cn("font-bold mb-2 uppercase text-xs tracking-wider", getAccentStyles('text').className)} style={getAccentStyles('text').style}>{t('multiplayer.room_active')}</p>
                                        <p className="font-mono text-sm break-all text-foreground group-hover:scale-105 transition-transform">{roomCode}</p>
                                        <p className={cn("text-[10px] mt-2 opacity-70", getAccentStyles('text').className)} style={getAccentStyles('text').style}>{t('multiplayer.click_copy')}</p>
                                    </button>
                                    <Button variant="danger" onClick={stop} className="w-full">
                                        {t('multiplayer.stop')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="px-4 text-center text-sm text-secondary">
                                {t('multiplayer.join_desc')}
                            </p>

                            {!mappedPort ? (
                                <>
                                    <Input
                                        label={t('multiplayer.room_code')}
                                        value={joinCode}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            setJoinCode(value);
                                            setJoinCodeError(validateJoinCode(value));
                                        }}
                                        onBlur={(e) => {
                                            setJoinCodeError(validateJoinCode(e.target.value));
                                        }}
                                        placeholder={t('multiplayer.code_placeholder')}
                                        className="font-mono text-center text-xs"
                                        error={joinCodeError || undefined}
                                    />
                                    <Button 
                                        onClick={join} 
                                        isLoading={isLoading} 
                                        className="w-full"
                                        disabled={!!joinCodeError || !joinCode.trim()}
                                    >
                                        {t('multiplayer.join_room')}
                                    </Button>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <div className={cn(
                                        "border rounded-xl p-4 text-center",
                                        getAccentStyles('soft-bg').className,
                                        getAccentStyles('soft-border').className
                                    )}
                                        style={{
                                            ...getAccentStyles('soft-bg').style,
                                            ...getAccentStyles('soft-border').style
                                        }}
                                    >
                                        <p className={cn("font-bold mb-2 uppercase text-xs tracking-wider", getAccentStyles('text').className)} style={getAccentStyles('text').style}>{t('multiplayer.tunnel_established')}</p>
                                        <p className="text-xl font-mono font-bold text-foreground select-all">
                                            localhost:{mappedPort}
                                        </p>
                                        <p className={cn("text-xs mt-2 opacity-70", getAccentStyles('text').className)} style={getAccentStyles('text').style}>{t('multiplayer.direct_connect')}</p>
                                    </div>
                                    <Button variant="danger" onClick={stop} className="w-full">
                                        {t('multiplayer.stop')}
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Status Message */}
                {status && (
                    <div className="text-center">
                        <p className="text-xs font-medium text-amber-600 animate-pulse dark:text-amber-300">{status}</p>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default MultiplayerPage;
