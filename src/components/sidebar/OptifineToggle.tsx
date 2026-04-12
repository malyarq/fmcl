import type { CSSProperties } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export function OptifineToggle(props: {
  isOptiFineSupported: boolean;
  useForge: boolean;
  useOptiFine: boolean;
  setUseOptiFine: (val: boolean) => void;
  disabled?: boolean;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg') => { className?: string; style?: CSSProperties };
}) {
  const { isOptiFineSupported, useForge, useOptiFine, setUseOptiFine, disabled, t, getAccentStyles } = props;

  // OptiFine requires Forge to be enabled
  if (!isOptiFineSupported || !useForge) return null;

  return (
    <Button
      onClick={() => setUseOptiFine(!useOptiFine)}
      disabled={disabled}
      variant={useOptiFine ? 'primary' : 'secondary'}
      className={cn('w-full justify-center', useOptiFine && getAccentStyles('bg').className)}
      style={useOptiFine ? getAccentStyles('bg').style : undefined}
    >
      {t('optifine.enable')}
    </Button>
  );
}

