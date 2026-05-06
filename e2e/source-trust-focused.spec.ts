import { test, expect } from '@playwright/test';
import path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'artifacts', 'screenshots');

test('Source Trust Center - AAPL Report', async ({ page }) => {
  // Track console messages
  const consoleLogs: string[] = [];
  page.on('console', (msg: any) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Navigate to app
  await page.goto('http://localhost:3000');
  await page.waitForTimeout(2000);

  // Handle login
  const loginInput = page.locator('input[placeholder*="OPERATOR CALLSIGN" i], input[placeholder*="CALLSIGN" i]').first();
  if (await loginInput.isVisible({ timeout: 3000 })) {
    await loginInput.fill('testuser');
    await loginInput.press('Enter');
    await page.waitForTimeout(2000);
  }

  // Ensure we're in English mode
  const langToggle = page.locator('button').filter({ hasText: /中|en/i }).first();
  if (await langToggle.isVisible({ timeout: 3000 })) {
    const currentText = await langToggle.textContent();
    if (currentText?.toLowerCase().includes('english')) {
      await langToggle.click();
      await page.waitForTimeout(1000);
    }
  }

  // Navigate to Report (智能报告 / Report)
  const navButtons = page.locator('aside button');
  const reportBtn = navButtons.filter({ hasText: /report|智能|报告/i }).first();

  console.log('Clicking Report button...');
  await reportBtn.click();
  await page.waitForTimeout(2000);

  // Find and fill the report form input. The top bar also has a readonly text
  // search input, so scope this to the editable report ticker field.
  const tickerInput = page.getByRole('textbox', { name: /NVDA/i });
  await expect(tickerInput).toBeEditable({ timeout: 15000 });

  console.log('Filling ticker input with AAPL...');
  await tickerInput.fill('AAPL');
  await tickerInput.press('Enter');

  // Wait for report generation
  console.log('Waiting for report to generate (15 seconds)...');
  await page.waitForTimeout(15000);

  // Take full page screenshot
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'aapl-report-full.png'),
    fullPage: true,
  });

  // Look for Source Trust Center
  const trustCenterText = page.getByText(/Source Trust Center|来源可信度中心/i).first();

  const hasTrustCenter = await trustCenterText.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('Source Trust Center visible:', hasTrustCenter);
  await expect(trustCenterText).toBeVisible();

  if (hasTrustCenter) {
    // Scroll to trust center
    await trustCenterText.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Take closeup screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'aapl-trust-center-closeup.png'),
      fullPage: false,
    });

    // Check for Overall Score
    const scoreElements = await page.locator('text=/\\d+').all();
    console.log('Found numeric elements:', scoreElements.length);

    // Check for confidence level badges
    const confidenceBadges = await page.locator('text=/high|medium|low|unknown/i').allTextContents();
    console.log('Confidence badges:', confidenceBadges.slice(0, 5));

    // Check for mode badge
    const modeBadge = await page.locator('text=/mode|模式/i').allTextContents();
    console.log('Mode badge:', modeBadge.slice(0, 3));

    // Check metrics
    const metrics = [
      'Official Sources',
      'SEC Filings',
      'Verified News',
      'High Confidence News',
      '官方来源',
      'SEC文件',
      '验证新闻',
      '高置信度',
    ];

    for (const metric of metrics) {
      const found = await page.locator(`text=${metric}`).count();
      if (found > 0) {
        console.log(`Found metric: ${metric}`);
      }
    }

    // Check for the bug: raw signal keys
    const hasRawKeys = await page.locator('text=no_strength_signal').or(
      page.locator('text=no_warning_signal')
    ).isVisible().catch(() => false);

    if (hasRawKeys) {
      console.log('BUG DETECTED: Raw translation keys visible!');
    } else {
      console.log('No raw translation keys found');
    }

    // Check strengths and warnings panels
    const strengthsText = await page.locator('text=/strength|优势|强项/i').allTextContents();
    const warningsText = await page.locator('text=/warning|警告|风险/i').allTextContents();

    console.log('Strengths found:', strengthsText.length > 0);
    console.log('Warnings found:', warningsText.length > 0);
  }

  // Check for console errors
  const errors = consoleLogs.filter(log => log.includes('[error]'));
  if (errors.length > 0) {
    console.log('Console errors:', errors.slice(0, 5));
  }

  // Get page text content for analysis
  const pageText = await page.locator('body').textContent();
  console.log('Page contains "Source Trust":', pageText?.toLowerCase().includes('source trust'));
  console.log('Page contains "来源可信度":', pageText?.includes('来源可信度'));

  await page.waitForTimeout(2000);
});
