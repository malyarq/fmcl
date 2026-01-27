import type { JavaManager } from '../../java/provisioning';

export async function resolveJavaPath(params: {
  javaManager: JavaManager;
  requiredJava: 8 | 17 | 21;
  customJavaPath?: string;
  onLog: (data: string) => void;
  onProgress: (data: { type: string; task: number; total: number }) => void;
}) {
  const { javaManager, requiredJava, customJavaPath, onLog, onProgress } = params;

  let javaPath = '';
  const customJava = (customJavaPath ?? '').trim();
  if (customJava) {
    onLog(`[Java] Validating custom Java path...`);
    const valid = await javaManager.validateJavaPath(customJava);
    if (valid) {
      if (requiredJava === 21) {
        try {
          const actualVersion = await javaManager.getJavaVersion(customJava);
          if (actualVersion === 21) {
            javaPath = customJava;
            onLog(`[Java] Using custom Java 21: ${customJava}`);
          } else {
            onLog(
              `[Java] Custom Java is version ${actualVersion}, but Java 21 is required. Falling back to installer.`
            );
          }
        } catch (e: unknown) {
          const errorMsg =
            e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
          onLog(`[Java] Could not verify custom Java version: ${errorMsg || e}. Falling back to installer.`);
        }
      } else {
        javaPath = customJava;
        onLog(`[Java] Using custom Java: ${customJava}`);
      }
    } else {
      onLog('[Java] Custom javaPath is invalid. Falling back to installer.');
    }
  }

  if (!javaPath) {
    onLog(`Preparing Java ${requiredJava} runtime...`);
    javaPath = await javaManager.getJavaPath(requiredJava, (msg, current, total) => {
      if (current !== undefined && total !== undefined) {
        onProgress({ type: `Java ${requiredJava}`, task: current, total });
      } else {
        onLog(`[Java] ${msg}`);
      }
    });
    onLog(`Java ${requiredJava} ready at: ${javaPath}`);
  }

  return javaPath;
}

