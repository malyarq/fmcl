import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { useMultiplayer } from '../features/multiplayer/hooks/useMultiplayer';
import { MultiplayerConnectionControls } from './MultiplayerConnectionControls';
import { Modal } from './ui/Modal';
import { Select } from './ui/Select';

export interface MultiplayerPageProps { onBack: () => void; }

const MultiplayerPage: React.FC<MultiplayerPageProps> = ({ onBack }) => {
  const { t } = useSettings();
  const multiplayer = useMultiplayer();

  return (
    <Modal isOpen onClose={onBack} closeLabel={t('general.close_dialog')} title={t('multiplayer.title')} className="max-w-lg">
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
        <MultiplayerConnectionControls multiplayer={multiplayer} />
      </div>
    </Modal>
  );
};

export default MultiplayerPage;
