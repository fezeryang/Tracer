import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Login
  const input = page.locator('input[placeholder="OPERATOR CALLSIGN"]');
  if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
    await input.fill('TEST_OP');
    await page.evaluate(() => { const form = document.querySelector('form'); if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); });
    await page.waitForTimeout(3000);
  }

  // Navigate to Report
  await page.evaluate(() => { const nav = document.querySelector('nav'); if (nav) { const b = nav.querySelectorAll('button'); if (b.length >= 2) b[1].click(); } });
  await page.waitForTimeout(2000);

  // Click Generate
  await page.evaluate(() => { const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('生成') || b.textContent.includes('Generate')); if (btn) btn.click(); });
  console.log('[TEST] Generating... waiting 165s');
  await page.waitForTimeout(165000);

  const text = await page.textContent('body');

  // Check for Chinese section headers
  const chineseSections = ['研究背景', '核心摘要', '数据质量评估', '行情表现分析', '基本面分析', '新闻与事件', '来源可信度', '波动率', '关键风险', '后续跟踪', '结论'];
  const foundCn = chineseSections.filter(s => text.includes(s)).length;
  const englishSections = ['Investment Context', 'Executive Summary', 'Data Quality', 'Price Action', 'Fundamentals Analysis', 'News & Events', 'Source Trust', 'Volatility', 'Key Risks', 'Conclusion'];
  const foundEn = englishSections.filter(s => text.includes(s)).length;
  const hasFallback = text.includes('timeout') || text.includes('回退');

  console.log('Chinese sections found:', foundCn, '/', chineseSections.length);
  console.log('English sections found:', foundEn, '/', englishSections.length);
  console.log('Fallback detected:', hasFallback);

  if ((foundCn >= 5 || foundEn >= 5) && !hasFallback) {
    console.log('*** RESULT: SUCCESS - Report generated successfully ***');
  } else if (hasFallback) {
    console.log('*** RESULT: FALLBACK - Report reverted to fallback ***');
  } else {
    console.log('*** RESULT: PENDING ***');
  }
}

main().catch(e => console.error(e));
