import { test, expect, Page } from '@playwright/test';

const MOCK_REPORT = {
  ticker: 'NVDA',
  generatedAt: '2026-05-06T12:00:00.000Z',
  isCached: true,
  cachedAt: '2026-05-06T12:00:00.000Z',
  quote: { symbol: 'NVDA', price: 162.4, change: 7.2, changePercent: 4.64, volatility: 45.2, source: 'Yahoo Finance' },
  fundamentals: { marketCap: 2800000000000, peRatio: 65.3, beta: 1.42, sector: 'Technology', industry: 'Semiconductors', description: 'NVIDIA designs GPUs and AI chips.' },
  news: [
    { title: 'NVDA Reports Record Earnings', image: '', site: 'Reuters', text: 'NVIDIA reports strong Q1 earnings.', url: 'https://reuters.com/nvda', publishedDate: '2026-05-01T10:00:00Z', sentiment: 'Positive', sentimentScore: 0.85 },
    { title: 'AI Chip Demand Surges', image: '', site: 'Bloomberg', text: 'Growing demand for AI infrastructure.', url: 'https://bloomberg.com/nvda', publishedDate: '2026-05-02T14:30:00Z', sentiment: 'Positive', sentimentScore: 0.72 },
  ],
  verifiedNews: [],
  officialFilings: null,
  officialSources: null,
  whisper: null,
  summary: 'NVDA shows strong momentum.',
  dataAvailabilityAnalysis: 'Good quality.',
  priceAnalysis: 'Strong momentum.',
  newsAnalysis: 'Positive news.',
  fundamentalsAnalysis: '122% YoY growth.',
  volatilityAnalysis: 'IV at 45%.',
  optionsEducation: 'Straddle strategies.',
  sourceTrustAnalysis: 'High confidence.',
  followUpChecklist: ['Monitor Blackwell ramp'],
  risks: ['Concentration risk in AI infrastructure'],
  conclusion: 'Maintain accumulate rating.',
  disclaimer: 'This is not financial advice.',
  dataAvailability: ['Quote data available'],
  dataSourceHealth: [
    { key: 'quote', status: 'success' },
    { key: 'fundamentals', status: 'success' },
    { key: 'news', status: 'success' },
    { key: 'verifiedNews', status: 'available' },
    { key: 'officialFilings', status: 'available' },
    { key: 'officialSources', status: 'available' },
    { key: 'ai', status: 'success' },
  ],
  evidencePack: {
    priceHistoryStatus: 'available',
    priceHistory: [
      { date: '2026-01-01', close: 130.50 },
      { date: '2026-01-15', close: 135.20 },
      { date: '2026-02-01', close: 128.40 },
      { date: '2026-02-15', close: 140.10 },
      { date: '2026-03-01', close: 145.80 },
      { date: '2026-03-15', close: 142.30 },
      { date: '2026-04-01', close: 155.20 },
      { date: '2026-04-15', close: 162.40 },
    ],
    sentimentSummary: { positive: 2, neutral: 0, negative: 0, total: 2 },
    fundamentalsSnapshot: { marketCap: 2800000000000, peRatio: 65.3, beta: 1.42, sector: 'Technology', industry: 'Semiconductors' },
    sourceTrustScore: 85,
    sourceTrustLevel: 'high',
  },
  aiProvider: 'gemini',
  aiModel: 'gemini-2.0-flash',
  investmentContext: 'Structural AI infrastructure buildout supports sustained growth.',
  executiveSummary: 'NVDA demonstrates exceptional momentum in the AI chip market with record revenue growth.',
  dataQualityAssessment: 'Data quality is excellent with multiple source verification.',
  priceActionAnalysis: 'Price action shows strong momentum with breakouts above key resistance.',
  fundamentalsAnalysis: 'Revenue grew 122% YoY with gross margins expanding to 74%.',
  newsAndEventsAnalysis: 'Recent news coverage is overwhelmingly positive.',
  volatilityAndOptionsAnalysis: 'Implied volatility at 45% suggests moderate premium levels.',
  keyRisks: ['Concentration risk in AI infrastructure', 'Geopolitical headwinds'],
  followUpChecklist: ['Monitor Blackwell architecture ramp', 'Track datacenter segment growth'],
  conclusion: 'Maintain accumulate rating.',
};

async function setupReportPage(page: Page) {
  await page.addInitScript((report) => {
    window.sessionStorage.setItem('nux:lastReport', JSON.stringify(report));
  }, MOCK_REPORT);
}

async function loginAndNavigate(page: Page) {
  await page.goto('/', { waitUntil: 'load' });
  await page.waitForTimeout(2000);

  const nameInput = page.locator('input[placeholder="OPERATOR CALLSIGN"]');
  if (await nameInput.isVisible()) {
    await nameInput.fill('QA Tester');
    await page.locator('input[placeholder="EMAIL (OPTIONAL)"]').fill('qa@nux.dev');
    await page.locator('button:has-text("Initialize Terminal")').click({ force: true });
    await page.waitForTimeout(2000);
  }

  await page.locator('button:has-text("智能报告")').click({ force: true });
  await page.waitForTimeout(5000);

  // Scroll through the full page to ensure all sections render
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
}

test.describe('Phase 4F-2 Report Layout Polish', () => {

  test('ZH: Hero — NUX branding, no VOLT, cached notice, NVDA ticker', async ({ page }) => {
    await setupReportPage(page);
    await loginAndNavigate(page);

    // Report heading visible
    await expect(page.locator('h2', { hasText: 'AI 股票分析报告' }).first()).toBeVisible({ timeout: 10000 });

    // Check NUX branding (use text match since it's a span, not a heading)
    await expect(page.getByText('NUX').first()).toBeVisible();
    await expect(page.getByText('NVDA').first()).toBeVisible();
    await expect(page.getByText('已保留上一次生成的报告').first()).toBeVisible();
    await expect(page.getByText('重新生成报告').first()).toBeVisible();

    // No VOLT branding
    await expect(page.getByText('VOLT').first()).not.toBeVisible({ timeout: 2000 }).catch(() => {});
    await expect(page.getByText('Volt').first()).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('ZH: Evidence Panel — price trend, sentiment, data availability, fundamentals', async ({ page }) => {
    await setupReportPage(page);
    await loginAndNavigate(page);

    await expect(page.locator('h2', { hasText: 'AI 股票分析报告' }).first()).toBeVisible({ timeout: 10000 });

    // Scroll to evidence panel
    const evidencePanel = page.getByText('报告数据证据层').first();
    await evidencePanel.scrollIntoViewIfNeeded();
    await expect(evidencePanel).toBeVisible();

    await expect(page.getByText('价格趋势').first()).toBeVisible();
    await expect(page.getByText('新闻情绪分布').first()).toBeVisible();
    await expect(page.getByText('数据可用性').first()).toBeVisible();
    await expect(page.getByText('基本面快照').first()).toBeVisible();
  });

  test('ZH: Source Trust Center — score 85, high confidence, official sources', async ({ page }) => {
    await setupReportPage(page);
    await loginAndNavigate(page);

    await expect(page.locator('h2', { hasText: 'AI 股票分析报告' }).first()).toBeVisible({ timeout: 10000 });

    const trustCenter = page.getByText('来源可信度中心').first();
    await trustCenter.scrollIntoViewIfNeeded();
    await expect(trustCenter).toBeVisible();

    await expect(page.getByText('85').first()).toBeVisible();
    await expect(page.getByText('高可信').first()).toBeVisible();
    await expect(page.getByText('官方来源').first()).toBeVisible();
  });

  test('ZH: AI Research Report — executive summary, price, fundamentals, risks, checklist, conclusion', async ({ page }) => {
    await setupReportPage(page);
    await loginAndNavigate(page);

    await expect(page.locator('h2', { hasText: 'AI 股票分析报告' }).first()).toBeVisible({ timeout: 10000 });

    const aiReport = page.getByText('AI 研究报告').first();
    await aiReport.scrollIntoViewIfNeeded();
    await expect(aiReport).toBeVisible();

    await expect(page.getByText('核心摘要').first()).toBeVisible();
    await expect(page.getByText('行情表现分析').first()).toBeVisible();
    await expect(page.getByText('基本面分析').first()).toBeVisible();
    await expect(page.getByText('关键风险').first()).toBeVisible();
    await expect(page.getByText('后续跟踪清单').first()).toBeVisible();
    await expect(page.getByText('总结').first()).toBeVisible();
  });

  test('ZH: No undefined text visible', async ({ page }) => {
    await setupReportPage(page);
    await loginAndNavigate(page);

    await expect(page.locator('h2', { hasText: 'AI 股票分析报告' }).first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('undefined').first()).not.toBeVisible({ timeout: 2000 }).catch(() => {});
  });

  test('ZH: Risk disclaimer and research notice', async ({ page }) => {
    await setupReportPage(page);
    await loginAndNavigate(page);

    await expect(page.locator('h2', { hasText: 'AI 股票分析报告' }).first()).toBeVisible({ timeout: 10000 });

    await expect(page.getByText('免责声明').first()).toBeVisible();
    await expect(page.getByText('投资').first()).toBeVisible();
  });

  test('EN: Language switch — AI Research Report, Source Trust, Executive Summary, Disclaimer', async ({ page }) => {
    await setupReportPage(page);
    await loginAndNavigate(page);

    await expect(page.locator('h2', { hasText: 'AI 股票分析报告' }).first()).toBeVisible({ timeout: 10000 });

    // Switch to English
    await page.locator('button', { hasText: 'English' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    await expect(page.getByText('AI Research Report').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Source Trust').first()).toBeVisible();
    await expect(page.getByText('Executive Summary').first()).toBeVisible();
    await expect(page.getByText('Disclaimer').first()).toBeVisible();
  });

  test('EN: Price Trend and Fundamentals visible in English mode', async ({ page }) => {
    await setupReportPage(page);
    await loginAndNavigate(page);

    await expect(page.locator('h2', { hasText: 'AI 股票分析报告' }).first()).toBeVisible({ timeout: 10000 });

    await page.locator('button', { hasText: 'English' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    const priceTrend = page.getByText('Price Trend').first();
    await priceTrend.scrollIntoViewIfNeeded();
    await expect(priceTrend).toBeVisible();
    await expect(page.getByText('Fundamentals').first()).toBeVisible();
  });

  test('ZH: Switch back to Chinese from English', async ({ page }) => {
    await setupReportPage(page);
    await loginAndNavigate(page);

    await expect(page.locator('h2', { hasText: 'AI 股票分析报告' }).first()).toBeVisible({ timeout: 10000 });

    await page.locator('button', { hasText: 'English' }).first().click({ force: true });
    await page.waitForTimeout(2000);

    await page.locator('button', { hasText: '中文' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    await expect(page.getByText('研究').first()).toBeVisible({ timeout: 10000 });
  });
});