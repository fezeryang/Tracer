import { test, expect, Page } from '@playwright/test';

const APP_URL = 'http://localhost:3000';

async function loginIfNeeded(page: Page) {
  await page.waitForTimeout(1500);
  const loginInput = page.locator('input[placeholder*="OPERATOR CALLSIGN" i], input[placeholder*="CALLSIGN" i]').first();
  if (await loginInput.isVisible({ timeout: 2500 }).catch(() => false)) {
    await loginInput.fill('testuser');
    await loginInput.press('Enter');
    await page.waitForTimeout(1500);
  }
}

async function openChainView(page: Page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await loginIfNeeded(page);

  const chainNav = page.locator('aside button').filter({ hasText: /chain|期权链/i }).first();
  await expect(chainNav).toBeVisible({ timeout: 10000 });
  await chainNav.click();

  await expect(page.getByText(/options chain|期权链/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('chain-grid-panel')).toBeVisible({ timeout: 10000 });
}

test.describe('Options Chain Terminal Workspace', () => {
  test('loads aligned chain grid with status and inspector', async ({ page }) => {
    await openChainView(page);

    await expect(page.getByTestId('chain-status-pill')).toBeVisible();
    const rows = page.locator('[data-testid^="chain-row-"]');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('chain-inspector')).toBeVisible();

    const expirationSelect = page.getByTestId('chain-expiration-select');
    await expect(expirationSelect).toBeVisible();
    const optionCount = await expirationSelect.locator('option').count();
    expect(optionCount).toBeGreaterThan(0);
  });

  test('supports row selection and analysis workspace switching', async ({ page }) => {
    await openChainView(page);

    const rows = page.locator('[data-testid^="chain-row-"]');
    const selectableRow = rows.nth(1);
    await expect(selectableRow).toBeVisible({ timeout: 10000 });
    await selectableRow.click();

    const inspector = page.getByTestId('chain-inspector');
    await expect(inspector).toContainText(/mid|provider|数据源/i);

    await page.getByTestId('chain-view-volatility').click();
    await expect(page.getByText(/IV Smile|期限结构|Term Structure/i).first()).toBeVisible({ timeout: 10000 });

    await page.getByTestId('chain-view-flow').click();
    await expect(page.getByText(/Gamma Exposure|仓位分布|Positioning/i).first()).toBeVisible({ timeout: 10000 });

    await page.getByTestId('chain-view-visual').click();
    await expect(page.getByText(/Liquidity Horizon/i)).toBeVisible({ timeout: 10000 });

    await page.getByTestId('chain-view-grid').click();
    await expect(page.getByTestId('chain-grid-panel')).toBeVisible();
  });

  test('runs scanner workspace without crashing in live or synthetic mode', async ({ page }) => {
    await openChainView(page);

    await page.getByTestId('chain-view-scanner').click();
    await expect(page.getByTestId('chain-scanner-panel')).toBeVisible({ timeout: 10000 });

    const rerunButton = page.getByTestId('chain-scanner-rerun');
    await expect(rerunButton).toBeVisible();
    await rerunButton.click();

    const scannerCards = page.getByTestId('chain-scanner-card');
    const emptyState = page.getByText(/No significant mispricings|没有显著定价偏差/i).first();
    const demoNotice = page.getByText(/Synthetic chain detected|模拟链/i).first();

    await expect(async () => {
      const cardCount = await scannerCards.count();
      const emptyVisible = await emptyState.isVisible().catch(() => false);
      const demoVisible = await demoNotice.isVisible().catch(() => false);
      expect(cardCount > 0 || emptyVisible || demoVisible).toBeTruthy();
    }).toPass({ timeout: 15000 });
  });
});
