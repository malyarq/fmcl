import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;
const systemChromiumPathCandidates = [
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
  '/opt/homebrew/bin/chromium',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter((candidate): candidate is string => Boolean(candidate));
const executablePath = systemChromiumPathCandidates.find((candidate) => existsSync(candidate));

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
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
        launchOptions: executablePath
          ? {
              executablePath,
            }
          : undefined,
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port}`,
    url: `${baseURL}/manual-verification.html?view=overview`,
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
});
