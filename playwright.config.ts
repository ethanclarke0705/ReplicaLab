import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  globalTimeout: 180_000,
  outputDir: 'output/browser/results',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'output/browser/report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4178/ReplicaLab/',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command:
      'pnpm preview --host 127.0.0.1 --port 4178 --strictPort --base /ReplicaLab/',
    url: 'http://127.0.0.1:4178/ReplicaLab/',
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
