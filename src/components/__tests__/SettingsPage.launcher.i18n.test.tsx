// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsPage from '../SettingsPage';

vi.mock('../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    hideLauncher: true,
    setHideLauncher: vi.fn(),
    showConsole: false,
    setShowConsole: vi.fn(),
    t: (key: string) =>
      ({
        'settings.title': 'Настройки лаунчера',
        'settings.done': 'Готово',
        'settings.tab_appearance': 'Внешний вид',
        'settings.tab_downloads': 'Загрузки',
        'settings.tab_launcher': 'Launcher',
        'settings.tab_storage': 'Хранилище',
        'settings.tab_accounts': 'Аккаунты',
        'settings.tab_statistics': 'Статистика',
        'settings.launcherHint': 'Управляйте поведением лаунчера, проверками обновлений и постоянными кэшами в одном месте.',
        'settings.performance': 'Скрывать лаунчер во время игры',
        'settings.performance_desc': 'Скрывать лаунчер во время игры для экономии ресурсов.',
        'settings.console': 'Консоль разработчика',
        'settings.console_desc': 'Оставляйте консоль разработчика доступной, когда нужно разбирать проблемы лаунчера.',
        'settings.ui_zoom': 'Масштаб интерфейса',
        'settings.animations': 'Включить анимации',
        'settings.animations_scope_desc': 'Управляет анимацией лаунчера и фоновыми эффектами, не меняя цвета или поверхности выбранной темы.',
        'settings.compact_mode': 'Компактный режим',
        'settings.compact_mode_desc': 'Уплотняет отступы и списки лаунчера; на активную тему это не влияет.',
        'settings.sidebar_position': 'Положение сайдбара',
        'settings.sidebar_position_left': 'Слева',
        'settings.sidebar_position_right': 'Справа',
        'settings.sidebar_position_desc': 'Перемещает только навигацию лаунчера, не меняя визуальный пресет.',
        'settings.launcher_runtime_title': 'Поведение лаунчера',
        'settings.launcher_runtime_desc': 'Настройте, как лаунчер ведет себя во время игры, диагностики и навигации по оболочке.',
        'settings.updatesTitle': 'Обновления',
        'settings.updatesDesc': 'Проверяйте обновления лаунчера по запросу.',
        'settings.reset': 'Сбросить',
      }[key] ?? key),
    minecraftPath: '/minecraft',
    setMinecraftPath: vi.fn(),
    autoDownloadThreads: true,
    setAutoDownloadThreads: vi.fn(),
    downloadThreads: 8,
    setDownloadThreads: vi.fn(),
    maxSockets: 16,
    setMaxSockets: vi.fn(),
    uiScale: 100,
    setUiScale: vi.fn(),
    disableAnimations: false,
    setDisableAnimations: vi.fn(),
    sidebarPosition: 'left',
    setSidebarPosition: vi.fn(),
    compactMode: true,
    setCompactMode: vi.fn(),
    getAccentStyles: () => ({ className: '', style: undefined }),
  }),
}));

vi.mock('../../features/updater/hooks/useAppUpdater', () => ({
  useAppUpdater: () => ({
    status: 'idle',
    updateInfo: null,
    progress: 0,
    checkForUpdates: vi.fn(),
    installUpdate: vi.fn(),
  }),
}));

vi.mock('../settings/tabs/AppearanceTab', () => ({
  AppearanceTab: () => <div>Appearance tab</div>,
}));

vi.mock('../settings/tabs/DownloadsTab', () => ({
  DownloadsTab: () => <div>Downloads tab</div>,
}));

vi.mock('../settings/tabs/StorageTab', () => ({
  StorageSettings: () => <div>Storage tab</div>,
}));

vi.mock('../../features/accounts/AccountsPage', () => ({
  AccountsPage: () => <div>Accounts tab</div>,
}));

vi.mock('../../features/settings/statistics/StatisticsTab', () => ({
  StatisticsTab: () => <div>Statistics tab</div>,
}));

vi.mock('../UpdateModal', () => ({
  UpdateModal: () => null,
}));

vi.mock('../../services/ipc/storageMaintenanceIPC', () => ({
  storageMaintenanceIPC: {},
}));

vi.mock('../../contexts/ToastContext', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock('../../services/ipc/cacheIPC', () => ({
  cacheIPC: {
    has: () => false,
    clear: vi.fn(),
    reload: vi.fn(),
  },
}));

vi.mock('../settings/tabs/game/MinecraftPathSection', () => ({
  MinecraftPathSection: () => <div>Путь к Minecraft</div>,
}));

describe('SettingsPage launcher i18n', () => {
  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })) as typeof window.matchMedia;
  });

  it('renders moved launcher-side runtime controls in Russian without leaking raw keys', async () => {
    const { container } = render(<SettingsPage onClose={vi.fn()} initialTab="launcher" />);

    expect(screen.getByText('Поведение лаунчера')).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Включить анимации' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Компактный режим' })).toBeTruthy();
    expect(screen.getByText('Положение сайдбара')).toBeTruthy();
    expect(screen.getByText('Путь к Minecraft')).toBeTruthy();

    expect(container.textContent).not.toContain('settings.launcher_runtime_title');
    expect(container.textContent).not.toContain('settings.animations_scope_desc');
    expect(container.textContent).not.toContain('settings.compact_mode_desc');
    expect(container.textContent).not.toContain('settings.sidebar_position_desc');
  });
});
