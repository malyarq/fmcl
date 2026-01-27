import type { CSSProperties } from 'react';
import { Select } from '../ui/Select';
import { cn } from '../../utils/cn';
import type { MCVersion } from '../../services/versions/types';
import type { VersionHint } from '../../utils/minecraftVersions';

export function VersionSection(props: {
  version: string;
  setVersion: (v: string) => void;
  versions: MCVersion[];
  currentHint: VersionHint | null;
  t: (key: string) => string;
}) {
  const { version, setVersion, versions, currentHint, t } = props;

  return (
    <div data-tour="version">
      <Select label={t('general.version')} value={version} onChange={(e) => setVersion(e.target.value)} className="font-mono">
        {versions.map((v) => (
          <option key={v.id} value={v.id}>
            {v.id}
          </option>
        ))}
      </Select>

      {currentHint && (
        <div className={cn('text-xs mt-2 font-medium px-2 py-1 rounded bg-black/5 dark:bg-white/5', currentHint.className)} style={currentHint.style as CSSProperties}>
          {currentHint.text}
        </div>
      )}
    </div>
  );
}

