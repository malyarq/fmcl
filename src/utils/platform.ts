type PlatformNavigator = Pick<Navigator, 'platform' | 'userAgent'>;

function getDefaultNavigator(): PlatformNavigator | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  return navigator;
}

export function isMacOsPlatform(target: PlatformNavigator | undefined = getDefaultNavigator()): boolean {
  if (!target) {
    return false;
  }

  return /(Mac|iPhone|iPad|iPod)/i.test(target.platform || target.userAgent || '');
}
