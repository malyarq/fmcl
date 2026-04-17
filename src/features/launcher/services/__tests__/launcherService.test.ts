import { describe, expect, it } from 'vitest';
import { createTranslator } from '../../../../contexts/settings/i18n';
import {
  getMeaningfulProgressPercent,
  getProgressStatus,
  shouldApplyLaunchStatus,
  type LauncherProgressEvent,
} from '../launcherService';

describe('launcherService launch-state authority', () => {
  const t = createTranslator('en');

  it('treats zero-byte progress as indeterminate instead of a fake percentage', () => {
    const progress: LauncherProgressEvent = { type: 'assets', task: 0, total: 100 };

    expect(getMeaningfulProgressPercent(progress)).toBeNull();
    expect(getProgressStatus(progress, t)).toEqual({
      stage: 'downloading',
      title: 'Downloading',
      detail: 'Game assets',
    });
  });

  it('formats meaningful progress with a localized percentage detail', () => {
    const progress: LauncherProgressEvent = { type: 'classes', task: 42, total: 100 };

    expect(getMeaningfulProgressPercent(progress)).toBe(42);
    expect(getProgressStatus(progress, t)).toEqual({
      stage: 'downloading',
      title: 'Downloading',
      detail: 'Game libraries - 42%',
    });
  });

  it('prevents logs from regressing a waiting launcher back into downloading', () => {
    expect(
      shouldApplyLaunchStatus({
        currentStage: 'waiting',
        nextStage: 'downloading',
        source: 'log',
      }),
    ).toBe(false);
  });

  it('still allows logs to promote waiting into running and any stage into failure', () => {
    expect(
      shouldApplyLaunchStatus({
        currentStage: 'waiting',
        nextStage: 'running',
        source: 'log',
      }),
    ).toBe(true);

    expect(
      shouldApplyLaunchStatus({
        currentStage: 'launching',
        nextStage: 'failed',
        source: 'log',
      }),
    ).toBe(true);
  });

  it('keeps authoritative same-stage status details instead of letting logs churn them', () => {
    expect(
      shouldApplyLaunchStatus({
        currentStage: 'downloading',
        nextStage: 'downloading',
        source: 'log',
      }),
    ).toBe(false);
  });
});
