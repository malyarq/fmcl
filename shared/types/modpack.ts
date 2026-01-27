/**
 * Тип модлоадера
 */
export type ModLoaderType = 'vanilla' | 'forge' | 'fabric' | 'quilt' | 'neoforge';

/**
 * Источник модпака
 */
export type ModpackSource = 'local' | 'curseforge' | 'modrinth';

/**
 * Метаданные модпака (хранятся в modpacks.json)
 */
export interface ModpackMetadata {
  /** Локальный уникальный ID модпака */
  id: string;
  /** Название модпака */
  name: string;
  /** Версия модпака */
  version?: string;
  /** Источник модпака */
  source: ModpackSource;
  /** ID на платформе (CurseForge projectId или Modrinth project_id) */
  sourceId?: string;
  /** ID версии на платформе */
  sourceVersionId?: string;
  /** Версия Minecraft */
  minecraftVersion: string;
  /** Модлоадер */
  modLoader?: {
    type: ModLoaderType;
    version?: string;
  };
  /** URL иконки модпака */
  iconUrl?: string;
  /** Описание модпака */
  description?: string;
  /** Автор модпака */
  author?: string;
  /** Дата создания */
  createdAt: string;
  /** Дата последнего обновления */
  updatedAt: string;
}

/**
 * Файл в манифесте CurseForge
 */
export interface CurseForgeManifestFile {
  /** CurseForge project ID */
  projectID: number;
  /** CurseForge file ID */
  fileID: number;
  /** Обязателен ли файл */
  required: boolean;
}

/**
 * Манифест CurseForge (manifest.json)
 */
export interface CurseForgeManifest {
  /** Версия формата манифеста (обычно 1) */
  manifestVersion: number;
  /** Тип манифеста */
  manifestType: 'minecraftModpack';
  /** Информация о Minecraft */
  minecraft: {
    /** Версия Minecraft */
    version: string;
    /** Модлоадеры */
    modLoaders: Array<{
      /** ID модлоадера (например, "forge-47.2.0") */
      id: string;
      /** Основной ли модлоадер */
      primary: boolean;
    }>;
  };
  /** Название модпака */
  name: string;
  /** Версия модпака */
  version: string;
  /** Автор модпака */
  author?: string;
  /** Список файлов (модов) */
  files: CurseForgeManifestFile[];
  /** Папка с оверрайдами (обычно "overrides") */
  overrides?: string;
}

/**
 * Файл в манифесте Modrinth
 */
export interface ModrinthManifestFile {
  /** Путь относительно корня инстанса */
  path: string;
  /** Хеши файла (минимум sha1 и sha512) */
  hashes: {
    sha1: string;
    sha512: string;
  };
  /** URL для скачивания */
  downloads: string[];
  /** Размер файла в байтах */
  fileSize: number;
  /** Окружение (client/server) */
  env?: {
    client?: 'required' | 'optional' | 'unsupported';
    server?: 'required' | 'optional' | 'unsupported';
  };
}

/**
 * Манифест Modrinth (modrinth.index.json)
 */
export interface ModrinthManifest {
  /** Версия формата (текущая: 1) */
  formatVersion: number;
  /** Игра (только "minecraft") */
  game: 'minecraft';
  /** Уникальный ID версии модпака */
  versionId: string;
  /** Название модпака */
  name: string;
  /** Краткое описание (опционально) */
  summary?: string;
  /** Список файлов */
  files: ModrinthManifestFile[];
}

/**
 * Универсальный манифест для внутреннего использования
 */
export interface ModpackManifest {
  /** Версия формата */
  formatVersion: number;
  /** Информация о Minecraft */
  minecraft: {
    version: string;
    modLoaders: Array<{
      id: string;
      primary: boolean;
    }>;
  };
  /** Название модпака */
  name: string;
  /** Версия модпака */
  version: string;
  /** Автор модпака */
  author?: string;
  /** Список файлов (универсальный формат) */
  files: Array<{
    /** CurseForge project ID */
    projectID?: number;
    /** CurseForge file ID */
    fileID?: number;
    /** Modrinth project ID */
    projectId?: string;
    /** Modrinth version ID */
    versionId?: string;
    /** Путь относительно инстанса (для Modrinth и локальных) */
    path?: string;
    /** Хеши (для Modrinth) */
    hashes?: {
      sha1?: string;
      sha512?: string;
    };
    /** URL для скачивания (для Modrinth) */
    downloads?: string[];
    /** Размер файла (для Modrinth) */
    fileSize?: number;
    /** Обязателен ли файл */
    required: boolean;
    /** Окружение (для Modrinth) */
    env?: {
      client?: 'required' | 'optional' | 'unsupported';
      server?: 'required' | 'optional' | 'unsupported';
    };
  }>;
  /** Папка с оверрайдами */
  overrides?: string;
}
