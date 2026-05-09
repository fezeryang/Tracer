import { Message, ShellViewMode, ChatIntent } from '../types';
import { Language } from '../i18n';
import { getCommandSpec, COMMANDS } from './chatCommandRegistry';
import {
  fetchStockQuote,
  fetchStockNews,
  fetchCompanyFundamentals,
  fetchInsiderTrading,
  fetchEarningsCalendar,
  fetchDividends,
  fetchHistoricalPrices,
} from './marketDataService';
import { fetchVerifiedStockNews } from './newsVerificationService';
import { fetchSecFilingsForTicker } from './secFilingService';
import { fetchOfficialSources } from './officialSourceService';
import { buildSourceTrustSummary } from './sourceTrustService';

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export interface CommandExecutorContext {
  language: Language;
  t: TranslateFn;
  addMessage: (msg: Message) => void;
  setTyping: (typing: boolean) => void;
  navigate: (view: ShellViewMode) => void;
  setTicker: (ticker: string) => void;
  resetMessages: (welcomeText: string) => void;
}

function missingTickerMessage(ctx: CommandExecutorContext): Message {
  return {
    id: (Date.now() + 1).toString(),
    role: 'model',
    text: ctx.t('chat.commands.missingTicker'),
  };
}

function fetchErrorMessage(ctx: CommandExecutorContext, error: any): string {
  if (error?.status === 429) return ctx.t('chat.commands.rateLimited');
  return ctx.t('chat.commands.fetchFailed');
}

export async function executeCommand(
  intent: ChatIntent,
  ctx: CommandExecutorContext,
): Promise<void> {
  const spec = getCommandSpec(intent.command || intent.name);
  if (!spec) {
    ctx.addMessage({
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: ctx.t('chat.commands.unknown'),
    });
    ctx.setTyping(false);
    return;
  }

  const ticker = intent.ticker?.toUpperCase();

  switch (spec.action) {
    case 'help': {
      const helpLines = [
        `## ${ctx.t('chat.commands.title')}`,
        '',
        `| ${ctx.t('chat.commands.help')} | Description |`,
        '|---|---|',
      ];
      for (const cmd of COMMANDS) {
        const desc = ctx.t(cmd.descriptionKey);
        helpLines.push(`| \`/${cmd.usage}\` | ${desc} |`);
      }
      ctx.addMessage({
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: helpLines.join('\n'),
      });
      ctx.setTyping(false);
      return;
    }

    case 'fetch_quote': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const quote = await fetchStockQuote(ticker);
        ctx.addMessage({
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: ctx.t('chat.commands.quoteResult', { ticker }),
          quote,
        } as Message);
      } catch (error: any) {
        console.warn('[Command] Quote fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: fetchErrorMessage(ctx, error) });
      }
      ctx.setTyping(false);
      return;
    }

    case 'fetch_news': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const news = await fetchStockNews(ticker);
        ctx.addMessage({
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: ctx.t('chat.commands.newsResult', { ticker }),
          news,
        } as Message);
      } catch (error: any) {
        console.warn('[Command] News fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: fetchErrorMessage(ctx, error) });
      }
      ctx.setTyping(false);
      return;
    }

    case 'fetch_fundamentals': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const fundamentals = await fetchCompanyFundamentals(ticker);
        ctx.addMessage({
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: ctx.t('chat.commands.fundamentalsResult', { ticker }),
          fundamentals,
        } as Message);
      } catch (error: any) {
        console.warn('[Command] Fundamentals fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: fetchErrorMessage(ctx, error) });
      }
      ctx.setTyping(false);
      return;
    }

    case 'navigate': {
      const targetView = spec.targetView;
      if (!ticker || !targetView) {
        ctx.setTyping(false);
        return;
      }
      ctx.setTicker(ticker);

      const navKey = targetView === 'report' ? 'openingReport'
        : targetView === 'chain' ? 'openingChain'
        : targetView === 'backtest' ? 'openingBacktest'
        : targetView === 'news-impact' ? 'openingImpact'
        : 'openingMacro';

      const navText = ctx.t(`chat.commands.${navKey}`, { ticker });
      ctx.addMessage({
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: navText,
      });

      setTimeout(() => ctx.navigate(targetView), 100);
      ctx.setTyping(false);
      return;
    }

    case 'clear': {
      ctx.resetMessages(ctx.t('chat.welcome'));
      ctx.setTyping(false);
      return;
    }

    // --- fetch_history: /history and /chart ---
    case 'fetch_history': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const history = await fetchHistoricalPrices(ticker, 252);
        if (history.length === 0) throw new Error('No data');
        const count = history.length;
        const prices = history.map(h => h.close);
        const dates = history.map(h => h.date);
        const latestClose = prices[prices.length - 1];
        const highestClose = Math.max(...prices);
        const lowestClose = Math.min(...prices);
        const chartData = history.map(h => ({ label: h.date, value: h.close }));

        ctx.addMessage({
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: ctx.t('chat.commands.historyResult', { ticker, count: String(count) }),
          blocks: [
            {
              type: 'data_quality',
              data: { quote: undefined, fundamentals: undefined, news: undefined },
            },
            {
              type: 'chart',
              title: `${ticker} ${ctx.t('chat.blocks.chart')}`,
              data: { chartData, chartType: 'line', chartColor: '#818cf8', yAxisLabel: 'Price' },
            },
            {
              type: 'metric_grid',
              metrics: [
                { label: ctx.t('history.dataPoints'), value: count },
                { label: ctx.t('history.startDate'), value: dates[0] || 'N/A' },
                { label: ctx.t('history.endDate'), value: dates[dates.length - 1] || 'N/A' },
                { label: ctx.t('history.latestClose'), value: `$${latestClose.toFixed(2)}` },
                { label: ctx.t('history.highestClose'), value: `$${highestClose.toFixed(2)}` },
                { label: ctx.t('history.lowestClose'), value: `$${lowestClose.toFixed(2)}` },
              ],
            },
            {
              type: 'disclaimer',
              content: ctx.t('history.researchOnly'),
              tone: 'info',
            },
          ],
        } as Message);
      } catch (error: any) {
        console.warn('[Command] History fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: fetchErrorMessage(ctx, error) });
      }
      ctx.setTyping(false);
      return;
    }

    // --- fetch_verified_news: /verified-news ---
    case 'fetch_verified_news': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const verifiedNews = await fetchVerifiedStockNews(ticker);
        const items = (verifiedNews || []).map((n: any) => ({
          label: `[${n.confidenceScore || '?'}%] ${n.title}${n.source ? ' — ' + n.source : ''}`,
          source: n.source,
          url: n.url,
        }));

        ctx.addMessage({
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: ctx.t('chat.commands.verifiedNewsResult', { ticker }),
          blocks: [
            {
              type: 'evidence_list',
              data: { evidence: items.length > 0 ? items : [{ label: ctx.t('evidence.noEvidence'), source: undefined, url: undefined }] },
            },
            {
              type: 'data_quality',
              data: { quote: undefined, fundamentals: undefined, news: undefined },
            },
          ],
        } as Message);
      } catch (error: any) {
        console.warn('[Command] Verified news fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: ctx.t('chat.commands.fetchFailed') });
      }
      ctx.setTyping(false);
      return;
    }

    // --- fetch_sec: /sec ---
    case 'fetch_sec': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const secData = await fetchSecFilingsForTicker(ticker);
        const filings = secData?.filings || [];
        const items = filings.map((f: any) => ({
          label: `${f.form || 'N/A'} | ${f.filingDate || 'N/A'}${f.description ? ': ' + f.description : ''}`,
          source: 'SEC EDGAR',
          url: f.url,
        }));

        if (secData?.status === 'unavailable') {
          ctx.addMessage({
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: ctx.t('chat.commands.secResult', { ticker }),
            blocks: [
              { type: 'evidence_list', data: { evidence: [{ label: ctx.t('sec.unavailable'), source: undefined, url: undefined }] } },
            ],
          } as Message);
        } else {
          ctx.addMessage({
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: ctx.t('chat.commands.secResult', { ticker }),
            blocks: [
              { type: 'evidence_list', data: { evidence: items } },
              { type: 'disclaimer', content: ctx.t('sec.officialDisclosureNotice'), tone: 'info' },
            ],
          } as Message);
        }
      } catch (error: any) {
        console.warn('[Command] SEC fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: ctx.t('chat.commands.fetchFailed') });
      }
      ctx.setTyping(false);
      return;
    }

    // --- fetch_official: /official ---
    case 'fetch_official': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const officialData = await fetchOfficialSources(ticker);
        const sources = officialData?.sources || [];
        const items = sources.map((s: any) => ({
          label: `${s.name || 'N/A'}${s.aiReviewed ? ' [' + ctx.t('evidence.aiVerified') + ']' : ' [' + ctx.t('evidence.requiresManualConfirmation') + ']'}`,
          source: s.type || 'N/A',
          url: s.url,
        }));

        if (officialData?.status === 'error' || officialData?.status === 'not_found') {
          ctx.addMessage({
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: ctx.t('chat.commands.fetchFailed'),
          });
        } else {
          ctx.addMessage({
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: ctx.t('chat.commands.officialResult', { ticker }),
            blocks: [
              { type: 'evidence_list', data: { evidence: items.length > 0 ? items : [{ label: ctx.t('evidence.noEvidence'), source: undefined, url: undefined }] } },
            ],
          } as Message);
        }
      } catch (error: any) {
        console.warn('[Command] Official sources fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: ctx.t('chat.commands.fetchFailed') });
      }
      ctx.setTyping(false);
      return;
    }

    // --- fetch_trust: /trust ---
    case 'fetch_trust': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const [verifiedNews, secData, officialData] = await Promise.all([
          fetchVerifiedStockNews(ticker),
          fetchSecFilingsForTicker(ticker),
          fetchOfficialSources(ticker),
        ]);
        const trustSummary = buildSourceTrustSummary({ ticker, verifiedNews, officialFilings: secData, officialSources: officialData });

        ctx.addMessage({
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: ctx.t('chat.commands.trustResult', { ticker }),
          blocks: [
            {
              type: 'source_trust',
              data: { trustSummary },
            },
            {
              type: 'metric_grid',
              metrics: [
                { label: ctx.t('sourceTrust.overallScore'), value: `${trustSummary.overallScore}/100` },
                { label: ctx.t('sourceTrust.confidenceLevel'), value: trustSummary.confidenceLevel },
                { label: ctx.t('sourceTrust.officialSources'), value: trustSummary.officialSourceCount },
                { label: ctx.t('sourceTrust.secFilings'), value: trustSummary.secFilingCount },
                { label: ctx.t('sourceTrust.verifiedNews'), value: trustSummary.verifiedNewsCount },
              ],
            },
          ],
        } as Message);
      } catch (error: any) {
        console.warn('[Command] Trust fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: ctx.t('chat.commands.fetchFailed') });
      }
      ctx.setTyping(false);
      return;
    }

    // --- fetch_evidence: /evidence ---
    case 'fetch_evidence': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const [quote, verifiedNews, secData, officialData] = await Promise.all([
          fetchStockQuote(ticker),
          fetchVerifiedStockNews(ticker).catch(() => []),
          fetchSecFilingsForTicker(ticker).catch(() => undefined),
          fetchOfficialSources(ticker).catch(() => undefined),
        ]);
        const trustSummary = buildSourceTrustSummary({ ticker, verifiedNews, officialFilings: secData, officialSources: officialData });

        const newsItems = (verifiedNews || []).map((n: any) => ({
          label: `[${n.confidenceScore || '?'}% ${ctx.t('evidence.verifiedNews')}] ${n.title}`,
          source: n.source,
          url: n.url,
        }));
        const secItems = (secData?.filings || []).map((f: any) => ({
          label: `${f.form || 'N/A'} (${f.filingDate || 'N/A'})`,
          source: 'SEC',
          url: f.url,
        }));
        const officialItems = (officialData?.sources || []).map((s: any) => ({
          label: s.name || 'N/A',
          source: s.type || 'N/A',
          url: s.url,
        }));
        const allEvidence = [...newsItems, ...secItems, ...officialItems];

        ctx.addMessage({
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: ctx.t('chat.commands.evidenceResult', { ticker }),
          blocks: [
            {
              type: 'data_quality',
              data: { quote: quote || undefined, fundamentals: undefined, news: undefined },
            },
            {
              type: 'source_trust',
              data: { trustSummary },
            },
            {
              type: 'evidence_list',
              data: { evidence: allEvidence.length > 0 ? allEvidence : [{ label: ctx.t('evidence.noEvidence'), source: undefined, url: undefined }] },
            },
            {
              type: 'action_buttons',
              actions: [
                { label: ctx.t('chat.actions.generateReport'), view: 'report', ticker },
                { label: ctx.t('chat.actions.analyzeNewsImpact'), view: 'news-impact', ticker },
                { label: ctx.t('chat.actions.viewMacro'), view: 'macro', ticker },
              ],
            },
          ],
        } as Message);
      } catch (error: any) {
        console.warn('[Command] Evidence fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: ctx.t('chat.commands.fetchFailed') });
      }
      ctx.setTyping(false);
      return;
    }

    // --- fetch_insiders: /insiders ---
    case 'fetch_insiders': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const data = await fetchInsiderTrading(ticker);
        if (data.status === 'unavailable') {
          ctx.addMessage({
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: ctx.t('chat.commands.insidersResult', { ticker }),
            blocks: [
              {
                type: 'evidence_list',
                data: { evidence: [{ label: ctx.t('insiders.unavailable'), source: undefined, url: undefined }] },
              },
            ],
          } as Message);
        } else {
          const tradeItems = (data.trades || []).slice(0, 20).map((t: any) => ({
            label: `${t.name || 'N/A'} — ${t.transactionType === 'buy' ? 'Buy' : 'Sell'} ${t.shares} shares @ $${t.price || 'N/A'}`,
            source: t.date || 'N/A',
            url: undefined,
          }));

          ctx.addMessage({
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: ctx.t('chat.commands.insidersResult', { ticker }),
            blocks: [
              {
                type: 'metric_grid',
                metrics: [
                  { label: ctx.t('insiders.totalBuys'), value: data.totalBuys, tone: data.totalBuys > data.totalSells ? 'positive' : 'neutral' },
                  { label: ctx.t('insiders.totalSells'), value: data.totalSells, tone: data.totalSells > data.totalBuys ? 'negative' : 'neutral' },
                  { label: ctx.t('insiders.transactionCount'), value: data.trades.length },
                  { label: ctx.t('insiders.netShares'), value: data.netShares, helper: data.sentiment },
                ],
              },
              {
                type: 'evidence_list',
                data: { evidence: tradeItems.length > 0 ? tradeItems : [{ label: 'No recent insider trades.', source: undefined, url: undefined }] },
              },
            ],
          } as Message);
        }
      } catch (error: any) {
        console.warn('[Command] Insiders fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: ctx.t('chat.commands.fetchFailed') });
      }
      ctx.setTyping(false);
      return;
    }

    // --- fetch_earnings: /earnings ---
    case 'fetch_earnings': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const earnings = await fetchEarningsCalendar(ticker);
        if (!earnings || earnings.length === 0) {
          ctx.addMessage({
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: ctx.t('chat.commands.earningsResult', { ticker }),
            blocks: [
              { type: 'evidence_list', data: { evidence: [{ label: ctx.t('earnings.unavailable'), source: undefined, url: undefined }] } },
            ],
          } as Message);
        } else {
          const latest = earnings[0];
          ctx.addMessage({
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: ctx.t('chat.commands.earningsResult', { ticker }),
            blocks: [
              {
                type: 'metric_grid',
                metrics: [
                  { label: ctx.t('earnings.date'), value: latest.date || 'N/A' },
                  { label: ctx.t('earnings.epsEstimate'), value: latest.epsEstimate != null ? `$${latest.epsEstimate}` : 'N/A' },
                  { label: ctx.t('earnings.epsActual'), value: latest.epsActual != null ? `$${latest.epsActual}` : 'N/A' },
                  { label: ctx.t('earnings.surprise'), value: latest.surprise || 'N/A' },
                ],
              },
            ],
          } as Message);
        }
      } catch (error: any) {
        console.warn('[Command] Earnings fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: ctx.t('chat.commands.fetchFailed') });
      }
      ctx.setTyping(false);
      return;
    }

    // --- fetch_dividends: /dividends ---
    case 'fetch_dividends': {
      if (!ticker) { ctx.addMessage(missingTickerMessage(ctx)); ctx.setTyping(false); return; }
      try {
        const dividends = await fetchDividends(ticker);
        if (!dividends || dividends.length === 0) {
          ctx.addMessage({
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: ctx.t('chat.commands.dividendsResult', { ticker }),
            blocks: [
              { type: 'evidence_list', data: { evidence: [{ label: ctx.t('dividends.unavailable'), source: undefined, url: undefined }] } },
            ],
          } as Message);
        } else {
          const items = dividends.slice(0, 20).map((d: any) => ({
            label: `${d.date || 'N/A'} — $${d.amount != null ? d.amount.toFixed(4) : 'N/A'}${d.paymentDate ? ' (Pay: ' + d.paymentDate + ')' : ''}`,
            source: 'Dividend',
            url: undefined,
          }));
          ctx.addMessage({
            id: (Date.now() + 1).toString(),
            role: 'model',
            text: ctx.t('chat.commands.dividendsResult', { ticker }),
            blocks: [
              { type: 'evidence_list', data: { evidence: items } },
            ],
          } as Message);
        }
      } catch (error: any) {
        console.warn('[Command] Dividends fetch failed:', error);
        ctx.addMessage({ id: (Date.now() + 1).toString(), role: 'model', text: ctx.t('chat.commands.fetchFailed') });
      }
      ctx.setTyping(false);
      return;
    }

    default: {
      ctx.addMessage({
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: ctx.t('chat.commands.unknown'),
      });
      ctx.setTyping(false);
    }
  }
}
