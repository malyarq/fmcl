import { useState } from 'react';
import { Input } from '../ui/Input';

export function NicknameSection(props: {
  nickname: string;
  setNickname: (name: string) => void;
  isOffline: boolean;
  t: (key: string) => string;
}) {
  const { nickname, setNickname, isOffline, t } = props;
  const [nicknameError, setNicknameError] = useState<string | null>(null);

  const validateNickname = (value: string): string | null => {
    if (!value.trim()) {
      return t('validation.nickname_required') || 'Никнейм обязателен';
    }
    if (value.trim().length < 3) {
      return t('validation.nickname_too_short') || 'Никнейм должен содержать минимум 3 символа';
    }
    if (value.trim().length > 16) {
      return t('validation.nickname_too_long') || 'Никнейм не должен превышать 16 символов';
    }
    // Minecraft: only Latin letters, numbers, underscores
    if (!/^[a-zA-Z0-9_]+$/.test(value.trim())) {
      return t('validation.nickname_invalid') || 'Только латиница, цифры и подчёркивания';
    }
    return null;
  };

  return (
    <div className="relative" data-tour="nickname">
      {isOffline && (
        <span className="absolute top-0 right-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-500 border border-amber-200 dark:border-amber-800/50 uppercase tracking-wider z-10">
          {t('general.offline')}
        </span>
      )}
      <Input
        label={t('general.nickname')}
        value={nickname}
        onChange={(e) => {
          const value = e.target.value;
          setNickname(value);
          setNicknameError(validateNickname(value));
        }}
        onBlur={(e) => {
          setNicknameError(validateNickname(e.target.value));
        }}
        placeholder="Steve"
        className="bg-white dark:bg-zinc-900"
        error={nicknameError || undefined}
        required
      />
    </div>
  );
}

