import { AuthServer } from '../auth/server';
import { runFullInstallationTest, type TestConfig } from './fullInstallationTest';

export async function runConfiguredFullTest(config: TestConfig): Promise<number> {
  const authServer = new AuthServer(0);
  try {
    const { url: authServerUrl } = await authServer.start();
    return await runFullInstallationTest(config, { authServerUrl });
  } catch (error) {
    console.error('[FullTest] Unhandled failure:', error);
    return 1;
  } finally {
    await authServer.stop();
  }
}
