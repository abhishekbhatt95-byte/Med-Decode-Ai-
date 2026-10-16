import { test, expect } from '@playwright/test';

test('measure hero visual layout at multiple viewports', async ({ page }) => {
  const viewports = [1728, 1440, 1280, 768, 375];
  for (const w of viewports) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const navLogoBox = await page.locator('header a[aria-label="MedDecode AI — Home"]').boundingBox();
    const heroBadgeBox = await page.getByText('PRIVATE & SECURE', { exact: true }).boundingBox();
    const navRightBox = await page.locator('header button[aria-label="Open Menu"]').boundingBox();
    const cardBox = await page.locator('text=PRESCRIPTION SUMMARY').boundingBox();
    const h1Box = await page.locator('h1').boundingBox();
    const h1LineHeight = await page.locator('h1').evaluate(el => window.getComputedStyle(el).lineHeight);
    const h1FontSize = await page.locator('h1').evaluate(el => window.getComputedStyle(el).fontSize);

    console.log(`\n=== Viewport: ${w}px ===`);
    console.log(`Logo X: ${navLogoBox?.x?.toFixed(1)}, Hero Badge X: ${heroBadgeBox?.x?.toFixed(1)}`);
    console.log(`Nav Right edge: ${((navRightBox?.x || 0) + (navRightBox?.width || 0)).toFixed(1)}, Card Right edge: ${((cardBox?.x || 0) + (cardBox?.width || 0)).toFixed(1)}`);
    console.log(`Top gap (Badge Y - Header bottom): ${((heroBadgeBox?.y || 0) - ((navLogoBox?.y || 0) + (navLogoBox?.height || 0))).toFixed(1)}px`);
    console.log(`H1 Font size: ${h1FontSize}, Line height: ${h1LineHeight}, H1 Height: ${h1Box?.height?.toFixed(1)}px`);
    
    // In wide viewports (1728, 1440), heading should wrap into 2 lines
    if (w >= 1440) {
      // With line-height ~1.0, 2 lines should be <= 2.2 * fontSize
      const fs = parseFloat(h1FontSize);
      const lines = Math.round((h1Box?.height || 0) / fs);
      console.log(`H1 Estimated Lines at ${w}px: ${lines}`);
      expect(lines).toBeLessThanOrEqual(2);
    }
  }
});
