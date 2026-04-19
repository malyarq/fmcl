import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../../../contexts/settings/i18n';
import {
  getLauncherSessionEndedLog,
  getLauncherUnavailableDetail,
  getVisibleLaunchFailureDetail,
} from '../../services/launcherService';

describe('launcher status copy', () => {
  const t = createTranslator('en');

  it('falls back to safe launcher-unavailable copy', () => {
    expect(getLauncherUnavailableDetail(t)).toBe('Launcher API is unavailable. Reload the launcher shell and try again.');
  });

  it('sanitizes wrapper errors before showing launch failure detail', () => {
    expect(getVisibleLaunchFailureDetail(new Error('[launcherIPC] launch failed: ${file.jarVersion}'), t)).toBe(
      'Review the error and try launching again.',
    );
  });

  it('keeps session-ended log lines readable without technical prefixes', () => {
    expect(getLauncherSessionEndedLog(0, t)).toBe('Minecraft session ended.');
    expect(getLauncherSessionEndedLog(12, t)).toBe('Minecraft session ended (exit code 12).');
  });
});
