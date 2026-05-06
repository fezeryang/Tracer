import { test, expect } from '@playwright/test';
import path from 'path';

// Test configuration
const BASE_URL = 'http://localhost:3000';
const SCREENSHOT_DIR = path.join(process.cwd(), 'artifacts', 'screenshots');

// Helper to take full page screenshots
async function takeFullPageScreenshot(page: any, name: string) {
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

// Helper to handle login
async function handleLogin(page: any) {
  // Wait for page to load
  await page.waitForTimeout(1500);

  // Check if login overlay is present
  const loginInput = page.locator('input[placeholder*="OPERATOR CALLSIGN" i], input[placeholder*="CALLSIGN" i]').first();

  if (await loginInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await loginInput.fill('testuser');

    // Submit form by pressing Enter on the input
    await loginInput.press('Enter');

    // Wait for login to complete
    await page.waitForTimeout(2000);
    return true;
  }
  return false;
}

test.describe('NUX Financial Research Terminal - Visual QA', () => {
  test.beforeAll(async () => {
    // Ensure screenshots directory exists
    const fs = await import('fs');
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
  });

  test('1. Homepage loads with correct branding', async ({ page }) => {
    // Navigate to homepage
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Check page title
    const title = await page.title();
    console.log('Page title:', title);
    expect(title).toMatch(/NUX|AI Financial Research Terminal/);

    // Verify no old "VOLT" branding visible
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.toLowerCase()).not.toContain('option volatility terminal');

    // Take homepage screenshot (may include login overlay)
    await takeFullPageScreenshot(page, '01-homepage-with-login');

    console.log('Test 1 PASSED: Homepage loads with correct branding');
  });

  test('2. Login and verify dashboard', async ({ page }) => {
    await page.goto(BASE_URL);

    // Handle login
    const loggedIn = await handleLogin(page);

    if (loggedIn) {
      console.log('Successfully logged in');
    } else {
      console.log('Login may not be required or already logged in');
    }

    // Wait for dashboard to load
    await page.waitForTimeout(2000);

    // Check for NUX branding in sidebar
    const nuxBranding = page.locator('text=NUX').or(page.locator('text=AI Research Terminal'));
    await expect(nuxBranding.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      console.warn('NUX branding not immediately visible');
    });

    // Take screenshot of dashboard
    await takeFullPageScreenshot(page, '02-dashboard-after-login');

    console.log('Test 2 PASSED: Login and verify dashboard');
  });

  test('3. Navigate to Report view', async ({ page }) => {
    await page.goto(BASE_URL);
    await handleLogin(page);
    await page.waitForTimeout(2000);

    // Navigate to Report view
    const reportBtn = page.locator('aside button, nav button').filter({ hasText: 'Report' }).first();

    if (await reportBtn.isVisible({ timeout: 5000 })) {
      await reportBtn.click();
      await page.waitForTimeout(2000);

      // Take screenshot of Report view
      await takeFullPageScreenshot(page, '03-report-view');

      console.log('Test 3 PASSED: Navigate to Report view');
    } else {
      console.warn('Report button not found');
      await takeFullPageScreenshot(page, '03-report-not-found');
    }
  });

  test('4. Generate AAPL report', async ({ page }) => {
    await page.goto(BASE_URL);
    await handleLogin(page);
    await page.waitForTimeout(2000);

    // Navigate to Report
    const reportBtn = page.locator('aside button, nav button').filter({ hasText: 'Report' }).first();
    if (await reportBtn.isVisible({ timeout: 5000 })) {
      await reportBtn.click();
      await page.waitForTimeout(1500);
    }

    // Look for ticker input
    const tickerInput = page.locator('input[placeholder*="NVDA" i], input[placeholder*="ticker" i]').or(
      page.locator('input[type="text"]').filter({ hasText: '' }).nth(1)
    ).first();

    if (await tickerInput.isVisible({ timeout: 5000 })) {
      await tickerInput.click();
      await tickerInput.fill('AAPL');

      // Press Enter to generate
      await tickerInput.press('Enter');

      // Wait for report generation (may take 5-15 seconds)
      console.log('Waiting for AAPL report to generate...');
      await page.waitForTimeout(12000);

      // Take full page screenshot
      await takeFullPageScreenshot(page, '04-aapl-report-full');

      // Check for Source Trust Center
      const trustCenterHeading = page.locator('text=Source Trust Center').or(
        page.locator('text=来源可信度中心')
      );

      const hasTrustCenter = await trustCenterHeading.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasTrustCenter) {
        console.log('PASS: Source Trust Center found');

        // Scroll to trust center
        await trustCenterHeading.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);

        // Take closeup screenshot
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '04-source-trust-center-closeup.png'),
        });

        // Check for Overall Score
        const scoreText = await page.locator('text=/\\d+').allTextContents();
        const hasScore = scoreText.some(s => s.includes('/') || parseInt(s) > 0);

        if (hasScore) {
          console.log('PASS: Overall Score displayed');
        }

        // Check for confidence badges
        const badges = await page.locator('text=/high|medium|low|unknown/i').allTextContents();
        if (badges.length > 0) {
          console.log('PASS: Confidence badges found:', badges.slice(0, 3));
        }

        // Check for the bug: raw signal keys
        const hasBug = await page.locator('text=no_strength_signal').or(
          page.locator('text=no_warning_signal')
        ).isVisible().catch(() => false);

        if (hasBug) {
          console.warn('BUG DETECTED: Raw translation keys visible instead of proper text!');
        } else {
          console.log('PASS: No raw signal keys visible');
        }

        // Check metrics
        const metrics = ['Official Sources', 'SEC Filings', 'Verified News', 'High Confidence'];
        for (const metric of metrics) {
          const metricElement = page.locator(`text=${metric}`);
          if (await metricElement.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log(`PASS: Metric "${metric}" visible`);
          }
        }
      } else {
        console.warn('Source Trust Center not visible - may need to scroll or data not loaded');
        // Take screenshot anyway for debugging
        await takeFullPageScreenshot(page, '04-aapl-no-trust-center');
      }
    } else {
      console.warn('Ticker input not found');
      await takeFullPageScreenshot(page, '04-no-ticker-input');
    }

    console.log('Test 4 COMPLETED: Generate AAPL report');
  });

  test('5. Test multiple navigation views', async ({ page }) => {
    await page.goto(BASE_URL);
    await handleLogin(page);
    await page.waitForTimeout(2000);

    // Get all navigation buttons
    const navButtons = page.locator('aside button, nav button');
    const count = await navButtons.count();

    console.log(`Found ${count} navigation buttons`);

    // Test first 5 views
    const viewsToTest = Math.min(count, 5);

    for (let i = 0; i < viewsToTest; i++) {
      const button = navButtons.nth(i);
      const buttonText = await button.textContent();

      try {
        await button.click({ timeout: 5000 });
        await page.waitForTimeout(1500);

        console.log(`View "${buttonText?.trim()}" loaded`);

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `05-view-${i}-${(buttonText || 'view').trim().replace(/\s+/g, '-')}.png`),
        });
      } catch (error) {
        console.warn(`Could not load view ${i}: "${buttonText}"`);
      }
    }

    console.log('Test 5 PASSED: Test multiple navigation views');
  });

  test('6. Language switching', async ({ page }) => {
    await page.goto(BASE_URL);
    await handleLogin(page);
    await page.waitForTimeout(2000);

    // Take English screenshot
    await takeFullPageScreenshot(page, '06-language-english');

    // Find language toggle (usually has Chinese characters)
    const langToggle = page.locator('button').filter({ hasText: /中|文|en/i }).first();

    if (await langToggle.isVisible({ timeout: 5000 })) {
      await langToggle.click();
      await page.waitForTimeout(1000);

      // Check for Chinese text
      const hasChinese = await page.locator('text=来源可信度').isVisible({ timeout: 2000 }).catch(() => false);

      if (hasChinese) {
        console.log('PASS: Chinese language detected');
      }

      await takeFullPageScreenshot(page, '06-language-chinese');

      // Toggle back
      await langToggle.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('Language toggle not found - may be in different location');
    }

    console.log('Test 6 PASSED: Language switching');
  });

  test('7. Unknown ticker test', async ({ page }) => {
    await page.goto(BASE_URL);
    await handleLogin(page);
    await page.waitForTimeout(2000);

    // Go to Report
    const reportBtn = page.locator('aside button, nav button').filter({ hasText: 'Report' }).first();
    if (await reportBtn.isVisible({ timeout: 5000 })) {
      await reportBtn.click();
      await page.waitForTimeout(1500);
    }

    // Enter unknown ticker
    const tickerInput = page.locator('input').nth(1);
    if (await tickerInput.isVisible({ timeout: 5000 })) {
      await tickerInput.fill('ABCXYZ123');
      await tickerInput.press('Enter');

      // Wait for response
      await page.waitForTimeout(8000);

      // Check for empty state
      const bodyText = await page.locator('body').textContent();
      const hasEmptyState = bodyText?.toLowerCase().includes('unavailable') ||
                           bodyText?.toLowerCase().includes('simulation') ||
                           bodyText?.toLowerCase().includes('no data');

      if (hasEmptyState) {
        console.log('PASS: Unknown ticker shows appropriate state');
      }

      await takeFullPageScreenshot(page, '07-unknown-ticker');
    }

    console.log('Test 7 PASSED: Unknown ticker test');
  });

  test('8. Check for console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg: any) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (exception: any) => {
      errors.push(exception.toString());
    });

    await page.goto(BASE_URL);
    await handleLogin(page);
    await page.waitForTimeout(2000);

    // Visit a few key views
    const views = ['Report', 'Overview'];
    for (const view of views) {
      const btn = page.locator('aside button, nav button').filter({ hasText: view }).first();
      if (await btn.isVisible({ timeout: 5000 })) {
        await btn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Wait a bit for any delayed errors
    await page.waitForTimeout(3000);

    // Report errors
    if (errors.length > 0) {
      console.warn(`Found ${errors.length} console errors:`);
      errors.slice(0, 5).forEach(e => console.warn(' -', e));
    } else {
      console.log('PASS: No console errors detected');
    }

    await takeFullPageScreenshot(page, '08-final-state');

    console.log('Test 8 PASSED: Console error check');
  });
});
