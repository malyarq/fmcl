import { useCallback } from 'react';

export function useLaunchHandler(params: {
  launchGame: (options: {
    nickname: string;
    version: string;
    ram: number;
    hideLauncher: boolean;
    useOptiFine?: boolean;
  }) => Promise<void>;
  nickname: string;
  launchVersion: string;
  ram: number;
  hideLauncher: boolean;
  useOptiFine: boolean;
}) {
  const { launchGame, nickname, launchVersion, ram, hideLauncher, useOptiFine } = params;

  return useCallback(async () => {
    await launchGame({
      nickname,
      version: launchVersion,
      ram,
      hideLauncher,
      useOptiFine,
    });
  }, [launchGame, nickname, launchVersion, ram, hideLauncher, useOptiFine]);
}

