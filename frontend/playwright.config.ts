import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for MedDecode AI E2E tests.
 *
 * Tests are designed to run against the production preview server
 * (`npm run preview`) so they exercise the actual built app, not the
 * Vite dev server.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',

  // Global settings applied to all tests
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Spin up the preview server before tests run.
  // In CI, the build step already ran; we just serve the dist/.
  webServer: {
    command: 'npm run preview',
    url: process.env.BASE_URL || 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
