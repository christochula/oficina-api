const { defineConfig } = require('@playwright/test');
const path = require('node:path');
const portalUrl = process.env.MANUAL_PORTAL_URL || 'http://localhost:5273';
const port = new URL(portalUrl).port || '5273';
const projectRoot = path.resolve(__dirname, '../..');

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: ['manual-portal.spec.cjs', 'preparation-portal.spec.cjs', 'recovery-portal.spec.cjs', 'desktop-pages.spec.cjs', 'consumption-portal.spec.cjs', 'rejection-portal.spec.cjs'],
  timeout: 420000,
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  outputDir: path.join(projectRoot, 'output/phase4-desktop'),
  reporter: [['list'], ['html', { outputFolder: path.join(projectRoot, 'output/phase4-desktop-report'), open: 'never' }], ['json', { outputFile: path.join(projectRoot, 'output/phase4-desktop-report.json') }]],
  use: { baseURL: portalUrl, headless: process.env.MANUAL_HEADED !== 'true', deviceScaleFactor: 1, trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 15000 },
  projects: [
    { name: 'desktop-1080p', use: { viewport: { width: 1920, height: 1080 } } },
    { name: 'desktop-1440p', testIgnore: ['recovery-portal.spec.cjs','consumption-portal.spec.cjs','rejection-portal.spec.cjs'], use: { viewport: { width: 2560, height: 1440 } } },
    { name: 'desktop-4k', testIgnore: ['recovery-portal.spec.cjs','consumption-portal.spec.cjs','rejection-portal.spec.cjs'], use: { viewport: { width: 3840, height: 2160 } } },
  ],
  webServer: {
    command: `npm run dev --prefix frontend -- --port ${port}`,
    cwd: path.resolve(__dirname, '../..'), url: portalUrl,
    reuseExistingServer: !process.env.CI, timeout: 30000,
    env: {
      LOCAL_DEMO_MODE: 'true', VITE_CLIENT_AUTH_BASE_URL: '',
      VITE_DEV_API_TARGET: process.env.OS_TEST_URL || 'http://127.0.0.1:3100',
      VITE_DEV_BILLING_TARGET: process.env.BILLING_TEST_URL || 'http://127.0.0.1:3101',
      VITE_DEV_PRODUCTION_TARGET: process.env.PRODUCTION_TEST_URL || 'http://127.0.0.1:3102',
    },
  },
});
