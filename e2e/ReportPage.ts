import { Page, Locator, expect } from '@playwright/test';

export class ReportPage {
  readonly page: Page;

  // Hero section
  readonly nuxWordmark: Locator;
  readonly tickerInput: Locator;
  readonly generateButton: Locator;
  readonly cachedNotice: Locator;

  // Evidence panel
  readonly evidencePanel: Locator;
  readonly priceTrend: Locator;
  readonly sentimentDistribution: Locator;
  readonly dataAvailability: Locator;
  readonly fundamentalsSnapshot: Locator;

  // Source Trust
  readonly sourceTrustCenter: Locator;
  readonly overallScore: Locator;

  // AI Research Report
  readonly aiResearchReport: Locator;
  readonly executiveSummary: Locator;

  // Navigation
  readonly sidebar: Locator;
  readonly reportNavButton: Locator;

  // Language
  readonly languageToggle: Locator;

  constructor(page: Page) {
    this.page = page;

    // Hero
    this.nuxWordmark = page.locator('text=NUX').first();
    this.tickerInput = page.locator('input[placeholder*="NVDA"], input[placeholder*="股票代码"], input[placeholder*="Ticker"]').first();
    this.generateButton = page.locator('button:has-text("重新生成报告"), button:has-text("Generate")').first();
    this.cachedNotice = page.locator('text=已保留上一次生成的报告, text=cached');

    // Evidence
    this.evidencePanel = page.locator('text=报告数据证据层');
    this.priceTrend = page.locator('text=价格趋势, text=Price Trend');
    this.sentimentDistribution = page.locator('text=新闻情绪分布, text=Sentiment');
    this.dataAvailability = page.locator('text=数据可用性, text=Data Availability');
    this.fundamentalsSnapshot = page.locator('text=基本面快照, text=Fundamentals Snapshot');

    // Source Trust
    this.sourceTrustCenter = page.locator('text=来源可信度中心, text=Source Trust');
    this.overallScore = page.locator('text=/\\d+/').first();

    // AI Research
    this.aiResearchReport = page.locator('text=AI 研究报告, text=AI Research Report');
    this.executiveSummary = page.locator('text=核心摘要, text=Executive Summary');

    // Navigation
    this.sidebar = page.locator('nav, aside').first();
    this.reportNavButton = page.locator('button:has-text("智能报告"), button:has-text("AI Research")');

    // Language
    this.languageToggle = page.locator('button:has-text("English"), button:has-text("中文")');
  }

  async goto() {
    const response = await this.page.goto('/', { waitUntil: 'load' });
    return response;
  }

  async login(name: string = 'QA Tester', email: string = 'qa@nux.dev') {
    const nameInput = this.page.locator('input[placeholder="OPERATOR CALLSIGN"]');
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.fill(name);
      await this.page.locator('input[placeholder="EMAIL (OPTIONAL)"]').fill(email);
      await this.page.locator('button:has-text("Initialize Terminal")').click({ force: true });
      await this.page.waitForTimeout(2000);
    }
  }

  async navigateToReport() {
    await this.reportNavButton.click({ force: true });
    // Wait for report content to be visible
    await this.page.waitForTimeout(3000);
    // Scroll to top to ensure hero is visible
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  async switchLanguage() {
    const langBtn = this.languageToggle.first();
    if (await langBtn.isVisible()) {
      await langBtn.click({ force: true });
      await this.page.waitForTimeout(3000);
    }
  }

  async getPageText(): Promise<string> {
    return this.page.evaluate(() => {
      const el = document.getElementById('root');
      return el ? el.innerText || el.textContent || '' : document.body.innerText || document.body.textContent || '';
    });
  }
}
