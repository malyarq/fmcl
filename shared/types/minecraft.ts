export interface LibraryEntry {
  url?: string;
  download?: {
    url?: string;
    path?: string;
  };
  downloads?: {
    artifact?: { url?: string; sha1?: string; path?: string };
    classifiers?: Record<string, { url?: string }>;
  };
}

export interface VersionEntry {
  id: string;
  type: string;
  url?: string;
  assetIndex?: { url?: string };
  downloads?: {
    client?: { url?: string };
    server?: { url?: string };
  };
}

