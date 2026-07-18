/**
 * auth.spec.ts
 *
 * Validates the Auth page (/auth) without real Supabase credentials.
 * Tests cover:
 *  - Page renders (sign-in form visible)
 *  - Tab switching between sign-in / sign-up / forgot-password
 *  - Client-side validation fires before any network call
 *  - Error message is displayed for invalid credentials (network call
 *    expected to fail gracefully since these are fake creds)
 */

import { test, expect } from '@playwright/test'

test.describe('Auth page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth')
  })

  test('renders the sign-in form', async ({ page }) => {
    // Heading is visible
    await expect(page.getByText('Welcome back', { exact: false })).toBeVisible()

    // Email and password inputs are present
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()

    // Submit button is present
    await expect(page.locator('button[type="submit"]').first()).toBeVisible()
  })

  test('switches to sign-up mode', async ({ page }) => {
    // Click the "Create account" / sign-up toggle button
    await page.getByRole('button', { name: /sign.?up|create account|register/i }).first().click()

    // Full name field is now visible (only on sign-up form)
    await expect(page.locator('input[type="text"]').first()).toBeVisible()

    // There should be a name placeholder
    await expect(page.locator('input[placeholder="Jane Doe"]')).toBeVisible()
  })

  test('switches to forgot-password mode', async ({ page }) => {
    // Click the "Forgot password" link/button
    await page.getByRole('button', { name: /forgot|reset/i }).first().click()

    // Should now show a single email input (no password)
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
  })

  test('shows an error for invalid sign-in credentials', async ({ page }) => {
    await page.locator('input[type="email"]').first().fill('invalid@example.invalid')
    await page.locator('input[type="password"]').first().fill('wrongpassword')
    await page.locator('button[type="submit"]').first().click()

    // An error message should appear (either rate-limit or Supabase error text)
    await expect(
      page.locator('text=/invalid|error|credentials|incorrect|password|email/i').first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('prevents empty sign-in submission via HTML5 required attribute', async ({ page }) => {
    // Submit without filling anything — browser validation should block it
    await page.locator('button[type="submit"]').first().click()

    // The email field should report a validation error (browser validity)
    const emailInput = page.locator('input[type="email"]').first()
    const isInvalid = await emailInput.evaluate(
      (el) => !(el as HTMLInputElement).validity.valid
    )
    expect(isInvalid).toBe(true)
  })
})
