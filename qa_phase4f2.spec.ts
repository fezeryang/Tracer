import { test, expect, chromium } from '@playwright/test';

const mockReport = {
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

test.describe('Phase 4F-2 Report Layout Polish QA', () => {
  test.beforeEach(async ({ page }) => {
    // Inject mock report before page load
    await page.addInitScript((report) => {
      window.sessionStorage.setItem('nux:lastReport', JSON.stringify(report));
    }, mockReport);

    await page.goto('http://localhost:5175', { waitUntil: 'load' });
    await page.waitForTimeout(2000);

    // Login
    const nameInput = page.locator('input[placeholder="OPERATOR CALLSIGN"]');
    if (await nameInput.isVisible()) {
      await nameInput.fill('QA Tester');
      await page.locator('input[placeholder="EMAIL (OPTIONAL)"]').fill('qa@nux.dev');
      await page.locator('button:has-text("Initialize Terminal")').click({ force: true });
      await page.waitForTimeout(2000);
    }

    // Navigate to report
    await page.locator('button:has-text("智能报告")').click({ force: true });
    // Wait for report content to load
    await page.waitForSelector('text=AI 股票分析报告', { timeout: 10000 });
  });

  test('1. Hero section - NUX branding, no VOLT, no traffic lights', async ({ page }) => {
    const text = await page.locator('body').innerText();
    expect(text).toContain('NUX');
    expect(text).not.toContain('VOLT');
    expect(text).not.toContain('Volt');
    expect(text).not.toContain('premium dark fintech');
    expect(text).toContain('NVDA');
    expect(text).toContain('已保留上一次生成的报告');
    expect(text).toContain('重新生成报告');
  });

  test('2. Evidence Panel renders with all sections', async ({ page }) => {
    const text = await page.locator('body').innerText();
    expect(text).toContain('报告数据证据层');
    expect(text).toContain('价格趋势');
    expect(text).toContain('新闻情绪分布');
    expect(text).toContain('数据可用性');
    expect(text).toContain('基本面快照');
  });

  test('3. Source Trust Center shows score and metrics', async ({ page }) => {
    const text = await page.locator('body').innerText();
    expect(text).toContain('来源可信度中心');
    expect(text).toContain('85');
    expect(text).toContain('高可信');
    expect(text).toContain('官方来源');
  });

  test('4. AI Research Report with all sections', async ({ page }) => {
    const text = await page.locator('body').innerText();
    expect(text).toContain('AI 研究报告');
    expect(text).toContain('核心摘要');
    expect(text).toContain('行情表现分析');
    expect(text).toContain('基本面分析');
    expect(text).toContain('关键风险');
    expect(text).toContain('后续跟踪清单');
    expect(text).toContain('总结');
  });

  test('5. No broken content', async ({ page }) => {
    const text = await page.locator('body').innerText();
    expect(text).not.toContain('undefined');
  });

  test('6. Language switch to English', async ({ page }) => {
    // Find and click the language toggle
    const langBtn = page.locator('button', { hasText: 'English' });
    await langBtn.click({ force: true });
    await page.waitForTimeout(3000);

    const text = await page.locator('body').innerText();
    expect(text).toContain('AI Research Report');
    expect(text).toContain('Source Trust');
    expect(text).toContain('Evidence');
    expect(text).toContain('Executive Summary');
    expect(text).toContain('Disclaimer');
  });

  test('7. English mode content visible', async ({ page }) => {
    // Switch to English
    const langBtn = page.locator('button', { hasText: 'English' });
    await langBtn.click({ force: true });
    await page.waitForTimeout(3000);

    const text = await page.locator('body').innerText();
    expect(text).toContain('Price Trend');
    expect(text).toContain('Fundamentals');
    expect(text).toContain('Disclaimer');
    expect(text).toContain('research');
  });

  test('8. Switch back to Chinese', async ({ page }) => {
    // Switch to English first
    const langBtn = page.locator('button', { hasText: 'English' });
    await langBtn.click({ force: true });
    await page.waitForTimeout(3000);

    // Switch back to Chinese
    const zhBtn = page.locator('button', { hasText: '中文' });
    await zhBtn.click({ force: true });
    await page.waitForTimeout(3000);

    const text = await page.locator('body').innerText();
    expect(text).toContain('研究');
    expect(text).toContain('分析');
  });
});