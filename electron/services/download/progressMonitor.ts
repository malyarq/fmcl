import fs from 'fs';
import { PROGRESS_CHECK_INTERVAL, PROGRESS_STALL_TIMEOUT } from '@shared/constants';

/**
 * Monitors download progress and aborts if progress stalls.
 * @param pendingFile Path to .pending file
 * @param abortController Controller for aborting download
 * @returns Function to stop monitoring
 */
export const monitorDownloadProgress = (pendingFile: string, abortController: AbortController): (() => void) => {
  let lastSize = 0;
  let lastProgressTime = Date.now();
  let isMonitoring = true;

  const checkProgress = () => {
    if (!isMonitoring) return;

    try {
      if (fs.existsSync(pendingFile)) {
        const stats = fs.statSync(pendingFile);
        const currentSize = stats.size;

        if (currentSize > lastSize) {
          lastSize = currentSize;
          lastProgressTime = Date.now();
        } else {
          const timeSinceProgress = Date.now() - lastProgressTime;
          if (timeSinceProgress >= PROGRESS_STALL_TIMEOUT) {
            isMonitoring = false;
            abortController.abort();
            return;
          }
        }
      } else {
        const timeSinceStart = Date.now() - lastProgressTime;
        if (timeSinceStart >= PROGRESS_STALL_TIMEOUT) {
          isMonitoring = false;
          abortController.abort();
          return;
        }
      }
    } catch {
      // Ignore file check errors
    }

    if (isMonitoring) {
      setTimeout(checkProgress, PROGRESS_CHECK_INTERVAL);
    }
  };

  lastProgressTime = Date.now();
  setTimeout(checkProgress, PROGRESS_CHECK_INTERVAL);

  return () => {
    isMonitoring = false;
  };
};

