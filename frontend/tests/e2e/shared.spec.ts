/**
 * shared.spec.ts
 *
 * Validates the shared result view (/share/:token).
 * Tests cover:
 *  - An invalid / expired token shows the "Access Link Expired" error UI
 *  - The error page does NOT expose internal stack traces or raw error JSON
 *  - The page title / OG heading is present
 *
 * NOTE: A valid token requires a live Supabase DB, so we test only the
 * error path which works entirely offline.
 */

import { test, expect } from '@playwright/test'

test.describe('Shared result page', () => {
  test('shows an expiry / invalid error for a fake token', async ({ page }) => {
    await page.goto('/share/definitely-not-a-real-token-abc123')

    // The SharedResultPage shows "Access Link Expired" for invalid tokens
    await expect(
      page.getByText(/expired|invalid|not found|access/i).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('does not expose raw error JSON or stack traces', async ({ page }) => {
    await page.goto('/share/fake-token-xyzzy')

    // Wait for the error state to resolve
    await page.waitForTimeout(3_000)

    const bodyText = await page.locator('body').innerText()

    // Must not contain raw JSON keys or stack trace markers
    expect(bodyText).not.toContain('"error"')
    expect(bodyText).not.toContain('at Object.')
    expect(bodyText).not.toContain('at async')
    expect(bodyText).not.toContain('stack:')
  })

  test('page renders with a document title', async ({ page }) => {
    await page.goto('/share/fake-token-for-title-check')

    // Any non-empty title is acceptable
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })

  test('does not show a blank white screen (runtime crash guard)', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (err) => errors.push(err.message))

    await page.goto('/share/crash-guard-token')
    await page.waitForTimeout(3_000)

    // The page should render something — not be completely empty
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.trim().length).toBeGreaterThan(0)

    // No uncaught JS errors
    expect(errors).toHaveLength(0)
  })
})
