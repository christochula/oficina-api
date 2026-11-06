const { defineConfig } = require('@playwright/test');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '../..');
const portalUrl = process.env.MANUAL_PORTAL_URL || 'http://localhost:5173';

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: 'manual-portal.spec.cjs',
  timeout: 420000,
  expect: { timeout: 15000 },
  workers: 1,
  fullyParallel: false,
  outputDir: path.join(projectRoot, 'output/phase4-manual-e2e'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(projectRoot, 'output/phase4-manual-e2e-report.json') }],
  ],
  use: { baseURL: portalUrl, headless: process.env.MANUAL_HEADED !== 'true', actionTimeout: 15000, navigationTimeout: 30000 },
  webServer: {
    command: 'npm run dev --prefix frontend',
    cwd: projectRoot,
    url: portalUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: {
      LOCAL_DEMO_MODE: 'true',
      VITE_CLIENT_AUTH_BASE_URL: '',
      VITE_DEV_API_TARGET: process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:3000',
      VITE_DEV_BILLING_TARGET: process.env.VITE_DEV_BILLING_TARGET || 'http://127.0.0.1:3001',
      VITE_DEV_PRODUCTION_TARGET: process.env.VITE_DEV_PRODUCTION_TARGET || 'http://127.0.0.1:3002',
    },
  },
});
