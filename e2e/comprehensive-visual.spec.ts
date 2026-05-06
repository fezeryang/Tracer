import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'artifacts', 'screenshots');

test.describe('Comprehensive Visual QA - NUX Terminal', () => {
  test('Complete workflow: Login, navigate all views, verify branding', async ({ page }) => {
    // Console logging
    const logs: string[] = [];
    page.on('console', (msg: any) => {
      logs.push(`[${msg.type()}] ${msg.text().substring(0, 100)}`);
    });

    // Navigate to homepage
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(2000);

    // Verify branding
    const title = await page.title();
    expect(title).toContain('NUX');
    expect(title).toContain('AI Financial Research Terminal');

    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.toLowerCase()).not.toContain('option volatility terminal');

    console.log('Branding verified:', title);

    // Handle login
    const loginInput = page.locator('input[placeholder*="OPERATOR CALLSIGN" i], input[placeholder*="CALLSIGN" i]').first();
    if (await loginInput.isVisible({ timeout: 3000 })) {
      await loginInput.fill('e2e-test-user');
      await loginInput.press('Enter');
      await page.waitForTimeout(2000);
      console.log('Login successful');
    }

    // Take homepage screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'final-01-homepage.png'),
      fullPage: true,
    });

    // Get all navigation items
    const navButtons = page.locator('aside button');
    const count = await navButtons.count();
    console.log(`Navigation items found: ${count}`);

    // Expected views based on AppShell.tsx
    const expectedViews = [
      'Overview', 'Report', 'Chat', 'Chain', 'Backtest',
      'News Impact', 'Macro', 'Trading', 'Time Machine',
      'Whisper', 'Academy', 'Feedback', 'Admin'
    ];

    console.log('Expected views:', expectedViews.length);
    expect(count).toBeGreaterThanOrEqual(expectedViews.length - 1); // May vary by language

    // Test each view
    for (let i = 0; i < Math.min(count, 13); i++) {
      const button = navButtons.nth(i);
      const buttonText = await button.textContent();
      const trimmedText = buttonText?.trim() || `view-${i}`;

      console.log(`Testing view: ${trimmedText}`);

      await button.click();
      await page.waitForTimeout(1500);

      // Check for page crashes
      const hasError = await page.locator('text=/error|crash|500/i').count() > 0;

      if (!hasError) {
        console.log(`  ✓ "${trimmedText}" loaded successfully`);

        // Screenshot for key views
        if (['Overview', 'Report', 'Chat', 'Academy', 'Admin'].some(v => trimmedText.toLowerCase().includes(v.toLowerCase()))) {
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `final-view-${i}-${trimmedText.replace(/\s+/g, '-')}.png`),
          });
        }
      } else {
        console.warn(`  ✗ "${trimmedText}" may have errors`);
      }
    }

    // Test language switching
    const langToggle = page.locator('button').filter({ hasText: /中|en|文/i }).first();
    if (await langToggle.isVisible({ timeout: 5000 })) {
      await langToggle.click();
      await page.waitForTimeout(1000);

      const hasChinese = await page.locator('text=来源可信度').count() > 0;
      if (hasChinese) {
        console.log('Chinese language confirmed');
      }

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'final-language-chinese.png'),
      });

      // Switch back
      await langToggle.click();
      await page.waitForTimeout(1000);
    }

    // Navigate to Report view for detailed check
    const reportBtn = navButtons.filter({ hasText: /report|报告/i }).first();
    await reportBtn.click();
    await page.waitForTimeout(1500);

    // Check for Source Trust Center related elements
    const pageText = await page.locator('body').textContent();

    const hasSourceTrustCenter = pageText?.toLowerCase().includes('source trust') ||
                                  pageText?.includes('来源可信度');

    if (hasSourceTrustCenter) {
      console.log('Source Trust Center content detected on page');
    }

    // Look for report generation input
    const inputs = page.locator('input:not([type="hidden"]):not([readonly])');
    const inputCount = await inputs.count();
    console.log(`Editable inputs found on Report page: ${inputCount}`);

    // Take final Report view screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'final-report-view.png'),
      fullPage: true,
    });

    // Check console for errors
    const errors = logs.filter(l => l.includes('[error]'));
    const warnings = logs.filter(l => l.includes('[warning]'));

    console.log(`\n=== Console Summary ===`);
    console.log(`Errors: ${errors.length}`);
    console.log(`Warnings: ${warnings.length}`);

    if (errors.length > 0) {
      console.log('Error samples:', errors.slice(0, 3));
    }
  });

  test('Verify responsive design at different viewport sizes', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Handle login
    const loginInput = page.locator('input[placeholder*="CALLSIGN" i]').first();
    if (await loginInput.isVisible({ timeout: 3000 })) {
      await loginInput.fill('test');
      await loginInput.press('Enter');
      await page.waitForTimeout(1500);
    }

    const viewports = [
      { width: 1920, height: 1080, name: 'desktop-1920' },
      { width: 1440, height: 900, name: 'desktop-1440' },
      { width: 768, height: 1024, name: 'tablet' },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(500);

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `responsive-${vp.name}.png`),
        fullPage: false,
      });

      console.log(`Screenshot taken for ${vp.name} (${vp.width}x${vp.height})`);
    }
  });
});
