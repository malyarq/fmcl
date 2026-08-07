import fs from 'node:fs';
import type { TestSummary } from './types';
import { safeStringify } from './utils';

export function saveSummary(jsonPath: string, summary: TestSummary): void {
  fs.writeFileSync(jsonPath, safeStringify(summary), 'utf8');
}

export function logFinalSummary(params: {
  summary: TestSummary;
  logPath: string;
  jsonPath: string;
  onLog: (line: string) => void;
}): void {
  const { summary, logPath, jsonPath, onLog } = params;

  const totalOk =
    summary.stages.vanilla.okCount +
    summary.stages.fabric.okCount +
    summary.stages.neoforge.okCount +
    summary.stages.forge.okCount +
    (summary.launch?.ok ? 1 : 0);
  const totalFail =
    summary.stages.vanilla.failCount +
    summary.stages.fabric.failCount +
    summary.stages.neoforge.failCount +
    summary.stages.forge.failCount +
    (summary.launch && !summary.launch.ok ? 1 : 0);

  onLog('═══════════════════════════════════════════════════════════');
  onLog(`[FullTest] FINAL SUMMARY:`);
  onLog(`  Vanilla: ${summary.stages.vanilla.okCount}/${summary.stages.vanilla.total} OK`);
  onLog(`  Fabric: ${summary.stages.fabric.okCount}/${summary.stages.fabric.total} OK`);
  onLog(`  NeoForge: ${summary.stages.neoforge.okCount}/${summary.stages.neoforge.total} OK`);
  onLog(`  Forge: ${summary.stages.forge.okCount}/${summary.stages.forge.total} OK`);
  if (summary.launch) {
    onLog(`  Game launch: ${summary.launch.ok ? 'PASS' : 'FAIL'} (${summary.launch.version ?? 'no version'}; ${summary.launch.signals.join(',') || 'no readiness signals'})`);
  }
  onLog(`  TOTAL: ${totalOk} OK, ${totalFail} FAIL`);
  onLog('═══════════════════════════════════════════════════════════');
  onLog(`[FullTest] Logs: ${logPath}`);
  onLog(`[FullTest] JSON: ${jsonPath}`);

  console.log(`[FullTest] Done. ok=${totalOk} fail=${totalFail}`);
  console.log(`[FullTest] Logs: ${logPath}`);
  console.log(`[FullTest] JSON: ${jsonPath}`);
}
