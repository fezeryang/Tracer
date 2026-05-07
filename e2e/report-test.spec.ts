import { test, expect } from '@playwright/test';

test.describe('Report Layout Test', () => {
  test('generate NVDA report and check layout', async ({ page }) => {
    // Listen for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Navigate to app
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take initial screenshot
    await page.screenshot({ path: 'e2e/screenshots/01-initial.png' });
    console.log('Screenshot 01 taken');

    // Handle login overlay by filling and submitting
    const overlayVisible = await page.locator('.fixed.inset-0.z-\\[100\\]').isVisible().catch(() => false);
    if (overlayVisible) {
      console.log('Filling login form...');
      try {
        // Fill username
        await page.fill('input[placeholder*="姓名"]', 'Test User');
        // Fill email
        await page.fill('input[type="email"]', 'test@example.com');
        // Submit form
        await page.click('button:has-text("进入系统")');
        await page.waitForTimeout(2000);
      } catch {
        // If form elements not found, try to click outside overlay
        await page.evaluate(() => {
          const overlay = document.querySelector('.fixed.inset-0.z-\\[100\\]');
          if (overlay) {
            (overlay as HTMLElement).style.display = 'none';
          }
        });
        await page.waitForTimeout(1000);
      }
    }

    // Click Report navigation using direct selector
    const reportButton = page.locator('button').filter({ hasText: /报告|Report/ }).first();
    await reportButton.click();
    await page.waitForTimeout(1500);

    // Screenshot report page
    await page.screenshot({ path: 'e2e/screenshots/02-report-page.png' });
    console.log('Screenshot 02 taken');

    // Find and fill the ticker input using its placeholder
    const tickerInput = page.locator('input[placeholder="NVDA"]');
    await tickerInput.waitFor({ state: 'visible', timeout: 5000 });
    await tickerInput.fill('AAPL'); // Use AAPL for testing
    console.log('Filled ticker input');

    await page.waitForTimeout(500);

    // Click generate button
    const genButton = page.locator('button').filter({ hasText: /生成报告|Generate Report/ }).first();
    await genButton.click();
    console.log('Clicked generate button');

    // Wait for report generation (may take 15-20 seconds)
    console.log('Waiting for report generation...');
    await page.waitForTimeout(20000);

    // Screenshot the generated report (full page)
    await page.screenshot({ path: 'e2e/screenshots/03-report-generated.png', fullPage: true });
    console.log('Screenshot 03 taken - full report');

    // Check for hardcoded purple colors in computed styles
    const purpleCheck = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const issues: string[] = [];

      allElements.forEach(el => {
        const styles = window.getComputedStyle(el);
        const bg = styles.backgroundColor;

        if (bg.includes('47, 107') || bg.includes('47,107') ||
            bg === 'rgb(47, 107, 255)' || bg === 'rgba(47, 107, 255, 0.14)') {
          issues.push(`Element with hardcoded purple: ${el.tagName}`);
        }
      });

      return issues;
    });

    console.log('Purple color issues found:', purpleCheck.length);
    console.log('Console errors:', errors.length);
    if (errors.length > 0) {
      errors.forEach(e => console.log('  Error:', e));
    }

    expect(purpleCheck.length).toBe(0);
  });
});
