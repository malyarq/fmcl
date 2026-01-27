import { Input } from '../../../ui/Input';

export function AutoConnectSection(props: {
  autoConnect: boolean;
  serverHost: string;
  serverPort: string;
  setAutoConnect: (next: boolean) => void;
  setServerHost: (next: string) => void;
  setServerPort: (next: string) => void;
  applyAutoConnect: (params: { enabled: boolean; host: string; portText: string }) => void;
  t: (key: string) => string;
}) {
  const { autoConnect, serverHost, serverPort, setAutoConnect, setServerHost, setServerPort, applyAutoConnect, t } = props;

  return (
    <>
      <div className="flex items-center justify-between p-3 bg-white/60 dark:bg-zinc-900/60 backdrop-blur-sm rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm hover:shadow-md transition-all">
        <div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{t('settings.autoconnect')}</p>
          <p className="text-xs text-zinc-500">{t('settings.autoconnect_desc')}</p>
        </div>
        <input
          type="checkbox"
          checked={autoConnect}
          onChange={(e) => {
            const next = e.target.checked;
            setAutoConnect(next);
            applyAutoConnect({ enabled: next, host: serverHost, portText: serverPort });
          }}
          className="w-4 h-4 rounded cursor-pointer accent-current text-zinc-800 dark:text-white"
        />
      </div>

      {autoConnect && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t('settings.server_host')}
            value={serverHost}
            onChange={(e) => {
              const v = e.target.value;
              setServerHost(v);
              applyAutoConnect({ enabled: true, host: v, portText: serverPort });
            }}
            placeholder="example.org"
          />
          <Input
            label={t('settings.server_port')}
            type="number"
            min={1}
            value={serverPort}
            onChange={(e) => {
              const v = e.target.value;
              setServerPort(v);
              applyAutoConnect({ enabled: true, host: serverHost, portText: v });
            }}
            placeholder="25565"
          />
        </div>
      )}
    </>
  );
}

