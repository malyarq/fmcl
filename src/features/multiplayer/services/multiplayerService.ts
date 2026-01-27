import { networkIPC } from '../../../services/ipc/networkIPC';

export function isNetworkAvailable() {
  return networkIPC.isAvailable();
}

export async function hostRoom(hostPort: number) {
  return await networkIPC.host(hostPort);
}

export async function joinRoom(joinCode: string) {
  return await networkIPC.join(joinCode);
}

export async function stopSession() {
  return await networkIPC.stop();
}

