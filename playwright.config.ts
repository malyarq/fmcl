import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const visualPort = 4173;
const visualBaseURL = `http://127.0.0.1:${visualPort}`;
export const PRODUCTION_PREVIEW_PORT = 4174;
export const PRODUCTION_PREVIEW_URL = `http://127.0.0.1:${PRODUCTION_PREVIEW_PORT}`;
const explicitChromiumPath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const executablePath = explicitChromiumPath && existsSync(explicitChromiumPath)
  ? explicitChromiumPath
  : undefined;

const chromiumLaunchOptions = executablePath
  ? {
      executablePath,
    }
  : undefined;

export const PERFORMANCE_PRODUCTION_PROJECT = {
  name: 'performance-production',
  workers: 1,
  use: {
    baseURL: PRODUCTION_PREVIEW_URL,
    browserName: 'chromium' as const,
    launchOptions: chromiumLaunchOptions,
    viewport: { width: 1280, height: 1024 },
    reducedMotion: 'reduce' as const,
    colorScheme: 'dark' as const,
  },
};

function isPerformanceOnlyInvocation(args: readonly string[]): boolean {
  return args.some((arg, index) => arg === '--project=performance-production'
    || (arg === '--project' && args[index + 1] === 'performance-production'));
}

const performanceOnlyInvocation = isPerformanceOnlyInvocation(process.argv);

export default defineConfig({
  testDir: './tests',
  testIgnore: '**/accessibility/__tests__/**',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: visualBaseURL,
    headless: true,
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        launchOptions: chromiumLaunchOptions,
      },
    },
    PERFORMANCE_PRODUCTION_PROJECT,
  ],
  webServer: performanceOnlyInvocation
    ? [{
      command: `node scripts/serve-manual-production.cjs --port ${PRODUCTION_PREVIEW_PORT}`,
      env: {
        NODE_ENV: 'production',
      },
      url: `${PRODUCTION_PREVIEW_URL}/fmcl-production-preview.json`,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    }]
    : [{
      command: `npm run dev -- --host 127.0.0.1 --port ${visualPort}`,
      env: {
        FMCL_RENDERER_ONLY: '1',
      },
      url: `${visualBaseURL}/manual-verification.html?view=overview`,
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    }],
});
