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
      <div className="surface-soft flex items-center justify-between gap-3 p-3 transition-colors hover:bg-card/84">
        <div>
          <p className="text-sm font-medium text-foreground">{t('settings.autoconnect')}</p>
          <p className="helper-text">{t('settings.autoconnect_desc')}</p>
        </div>
        <input
          type="checkbox"
          checked={autoConnect}
          onChange={(e) => {
            const next = e.target.checked;
            setAutoConnect(next);
            applyAutoConnect({ enabled: next, host: serverHost, portText: serverPort });
          }}
          className="h-4 w-4 cursor-pointer rounded border-border bg-card text-[rgb(var(--accent-main))] focus:ring-2 focus:ring-[rgb(var(--accent-main))] focus:ring-offset-2 focus:ring-offset-background"
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
