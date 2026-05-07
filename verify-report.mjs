import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  // Log report API calls
  page.on('request', req => {
    if (req.url().includes('/api/ai/report')) console.log('[NET] Calling DeepSeek report API');
  });
  page.on('response', async resp => {
    if (resp.url().includes('/api/ai/report')) {
      console.log('[NET] Report API status:', resp.status());
      try {
        const body = await resp.json();
        console.log('[NET] Report result:', JSON.stringify({ ok: body.ok, provider: body.provider, error: body.error?.substring(0, 100) }));
      } catch(e) {}
    }
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Login
  const input = page.locator('input[placeholder="OPERATOR CALLSIGN"]');
  if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
    await input.fill('TEST_OP');
    await page.evaluate(() => {
      const form = document.querySelector('form');
      if (form) form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    });
    await page.waitForTimeout(3000);
  }

  // Navigate to Report (2nd nav button)
  await page.evaluate(() => {
    const nav = document.querySelector('nav');
    if (nav) {
      const buttons = nav.querySelectorAll('button');
      if (buttons.length >= 2) buttons[1].click();
    }
  });
  await page.waitForTimeout(3000);

  // Set ticker
  const tickerInput = page.locator('input[placeholder="NVDA"]');
  if (await tickerInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await tickerInput.fill('');
    await tickerInput.fill('NVDA');
  }

  // Generate report
  const genBtn = page.locator('button:has-text("生成"), button:has-text("Generate")').first();
  const visible = await genBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('Generate button visible:', visible);

  if (visible) {
    await genBtn.click();
  } else {
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const genButton = buttons.find(b => b.textContent.includes('生成') || b.textContent.includes('Generate'));
      if (genButton) genButton.click();
    });
  }
  console.log('[TEST] Report generation started - waiting 160s...');

  // Wait
  await page.waitForTimeout(160000);
  await page.screenshot({ path: '/tmp/report-final.png' });

  // Check results
  const text = await page.textContent('body');
  const sections = ['Investment Context','Executive Summary','Data Quality','Price Action','Fundamentals Analysis','News & Events','Source Trust','Volatility','Key Risks','Conclusion'];
  const found = sections.filter(s => text.includes(s)).length;
  const hasFallback = text.includes('timeout') || text.includes('回退');

  console.log('\n=== RESULTS ===');
  console.log('Sections found:', found, '/', sections.length);
  console.log('Fallback detected:', hasFallback);

  if (found >= 6 && !hasFallback) {
    console.log('*** RESULT: SUCCESS ***');
  } else if (hasFallback) {
    console.log('*** RESULT: FALLBACK detected ***');
  } else {
    console.log('*** RESULT: PENDING - browser open ***');
  }
}

main().catch(e => console.error('FATAL:', e.message));
