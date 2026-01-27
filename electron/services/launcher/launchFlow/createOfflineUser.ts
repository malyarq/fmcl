import { getOfflineUUID, offline } from '@xmcl/user';

export function createOfflineUser(nickname: string) {
  const offlineUuidRaw = getOfflineUUID(nickname);
  const offlineUuid = offlineUuidRaw.includes('-')
    ? offlineUuidRaw
    : `${offlineUuidRaw.substring(0, 8)}-${offlineUuidRaw.substring(8, 12)}-${offlineUuidRaw.substring(
        12,
        16
      )}-${offlineUuidRaw.substring(16, 20)}-${offlineUuidRaw.substring(20)}`;
  return offline(nickname, offlineUuid);
}

