const path = require('node:path');
const { defineConfig } = require('@playwright/test');

const runId = process.env.VIDEO_REHEARSAL_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
if (!/^[a-zA-Z0-9_-]+$/.test(runId)) throw new Error('VIDEO_REHEARSAL_RUN_ID must be a simple directory name.');
process.env.VIDEO_REHEARSAL_RUN_ID = runId;
const directory = path.resolve(__dirname, '../../output/video-readiness', runId);
process.env.VIDEO_REHEARSAL_RUN_DIR = directory;

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['video-rehearsal.spec.cjs', 'video-payment-recovery.spec.cjs'],
  outputDir: path.join(directory, 'artifacts'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 360_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(directory, 'playwright-results.json') }],
    ['html', { outputFolder: path.join(directory, 'report'), open: 'never' }],
  ],
  use: {
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    // Authentication requests contain credentials. Keep traces/HAR/video disabled.
    trace: 'off',
    video: 'off',
    screenshot: 'off',
  },
  // Deliberately no webServer or Compose lifecycle: use the existing isolated stack.
});
