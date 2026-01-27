import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { useToast } from '../../../../contexts/ToastContext';
import { settingsIPC } from '../../../../services/ipc/settingsIPC';

export function MinecraftPathSection(props: {
  minecraftPath: string;
  setMinecraftPath: (val: string) => void;
  t: (key: string) => string;
}) {
  const { minecraftPath, setMinecraftPath, t } = props;
  const toast = useToast();

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 block">
        {t('settings.minecraft_path')}
      </label>
      <div className="flex gap-2 items-center">
        <div className="flex-1 min-w-0">
          <Input
            value={minecraftPath}
            onChange={(e) => setMinecraftPath(e.target.value)}
            placeholder={t('settings.minecraft_path_placeholder')}
            containerClassName="mb-0 gap-0"
          />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            onClick={async () => {
              try {
                const result = await settingsIPC.selectMinecraftPath();
                if (result.success && result.path) {
                  setMinecraftPath(result.path);
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                toast.error(t('error.selecting_folder') + ': ' + errorMessage);
              }
            }}
            className="h-[42px]"
          >
            {t('settings.browse')}
          </Button>
          <Button
            onClick={async () => {
              try {
                const pathToOpen = minecraftPath || (await settingsIPC.getDefaultMinecraftPath());
                await settingsIPC.openMinecraftPath(pathToOpen);
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                toast.error(t('error.opening_folder') + ': ' + errorMessage);
              }
            }}
            variant="secondary"
            className="h-[42px] bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
          >
            {t('settings.open_folder')}
          </Button>
        </div>
      </div>
    </div>
  );
}

