import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  RefreshCw,
  ChevronDown,
  Layers,
  BarChart3,
  Radar,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BrainCircuit,
  X,
  Activity,
  CandlestickChart,
  Box,
} from 'lucide-react';
import { OptionsChain, OptionContract } from '../types';
import { fetchOptionsChain, calculateBlackScholes, calculateHestonPrice, fetchTermStructure } from '../services/marketDataService';
import { createChatSession } from '../services/geminiService';
import OptionsChainVisualizer from './OptionsChainVisualizer';
import ChainVolatilityPanel from './ChainVolatilityPanel';
import ChainFlowPanel from './ChainFlowPanel';
import ExpirationCalendar from './ExpirationCalendar';
import VolatilitySurface from './VolatilitySurface';
import { Language, t } from '../i18n';
import { NuxPageHeader, NuxNotice, RiskDisclaimer } from './NuxPage';

interface OptionsChainViewProps {
  language?: Language;
  initialTicker?: string;
  onSelectContract?: (ticker: string, expiration: string, contract: OptionContract, currentPrice: number) => void;
}

interface ScannerResult {
  contract: OptionContract;
  marketPrice: number;
  bsPrice: number;
  hestonPrice: number;
  edgeToBs: number;
  edgeToHeston: number;
  confidence: number;
  recommendation: 'BUY' | 'SELL';
  spread?: {
    longLeg: OptionContract;
    shortLeg: OptionContract;
  };
}

type ViewMode = 'grid' | 'volatility' | 'flow' | 'scanner' | 'visual';
type ContractSide = 'call' | 'put';

const gridTemplate = '96px 96px 84px 72px 78px 78px 78px 86px 86px 86px 88px 88px 72px 72px 96px 96px 84px 72px 78px 78px 78px 86px 86px';

const formatPct = (value?: number) => `${((value || 0) * 100).toFixed(1)}%`;

const formatSigned = (value?: number, digits = 2) => {
  const num = value || 0;
  return `${num > 0 ? '+' : ''}${num.toFixed(digits)}`;
};

const getContractLabel = (contract: OptionContract) => `${contract.strike} ${contract.type.toUpperCase()}`;

const OptionsChainView: React.FC<OptionsChainViewProps> = ({ language = 'zh', initialTicker = 'SPY', onSelectContract }) => {
  const [ticker, setTicker] = useState(initialTicker.toUpperCase());
  const [tickerEdited, setTickerEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chain, setChain] = useState<OptionsChain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [volView3D, setVolView3D] = useState(false);
  const [selectedStrike, setSelectedStrike] = useState<number | null>(null);
  const [selectedSide, setSelectedSide] = useState<ContractSide>('call');
  const [scannerResults, setScannerResults] = useState<ScannerResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [termStructure, setTermStructure] = useState<Array<{ expiration: string; dte: number; atmIv: number; expectedMove: number }>>([]);
  const [quantMemo, setQuantMemo] = useState<{ id: string; text: string } | null>(null);
  const [generatingMemo, setGeneratingMemo] = useState<string | null>(null);

  const [moneynessFilter, setMoneynessFilter] = useState<'all' | 'itm' | 'otm' | 'atm'>('all');
  const [deltaFilter, setDeltaFilter] = useState<'all' | 'deep_itm' | 'near' | 'otm'>('all');
  const [liquidOnly, setLiquidOnly] = useState(false);
  const [realOnly, setRealOnly] = useState(false);
  const [minVolume, setMinVolume] = useState(0);
  const [minOi, setMinOi] = useState(0);
  const [maxSpreadPct, setMaxSpreadPct] = useState(0.25);

  // Scanner settings
  const [showScannerSettings, setShowScannerSettings] = useState(false);
  const [hestonKappa, setHestonKappa] = useState(1.5);
  const [hestonXi, setHestonXi] = useState(0.5);
  const [hestonRho, setHestonRho] = useState(-0.5);
  const [minEdgeThreshold, setMinEdgeThreshold] = useState(8);
  const [maxScannerSpread, setMaxScannerSpread] = useState(0.15);
  const [scannerMode, setScannerMode] = useState<'single' | 'vertical'>('single');

  const resetHestonParams = () => {
    if (!chain) return;
    const atmIv = (chain.aggregateStats?.atmIv || 25) / 100;
    const ticker = chain.symbol;

    // Sector-based kappa
    const indexEtfs = ['SPY', 'QQQ', 'IWM', 'DIA', 'IVV', 'VOO'];
    const techNames = ['AAPL', 'MSFT', 'NVDA', 'AMD', 'INTC', 'CRM', 'ADBE', 'ORCL', 'NOW'];
    const consumerNames = ['COST', 'WMT', 'HD', 'MCD', 'NKE', 'SBUX', 'DIS', 'TGT'];

    let kappa = 2.5;
    if (indexEtfs.includes(ticker)) kappa = 3.0;
    else if (techNames.includes(ticker)) kappa = 1.5;
    else if (consumerNames.includes(ticker)) kappa = 2.5;

    let rho = -0.5;
    if (indexEtfs.includes(ticker)) rho = -0.7;

    setHestonKappa(kappa);
    setHestonXi(atmIv * 1.5);
    setHestonRho(rho);
  };

  const loadChain = async (symbol: string, expiration?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOptionsChain(symbol, expiration);
      setChain(data);
      setScannerResults([]);
      const atmRow = data.rows?.find((row) => row.isAtm) || data.rows?.[0];
      setSelectedStrike(atmRow?.strike || null);
      setSelectedSide('call');
    } catch (err) {
      console.error(err);
      setError(t(language, 'chain.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChain(ticker);
  }, []);

  useEffect(() => {
    const normalized = initialTicker.trim().toUpperCase();
    if (!normalized || tickerEdited || normalized === ticker) return;
    setTicker(normalized);
    loadChain(normalized);
  }, [initialTicker, ticker, tickerEdited]);

  useEffect(() => {
    if (!chain) return;
    let cancelled = false;

    const loadStructure = async () => {
      try {
        const structure = await fetchTermStructure(chain.symbol);
        if (!cancelled && structure.length > 0) {
          setTermStructure(structure);
        } else if (!cancelled) {
          setTermStructure([{
            expiration: chain.selectedExpiration,
            dte: chain.rows?.[0]?.dte || 0,
            atmIv: chain.aggregateStats?.atmIv || 0,
            expectedMove: chain.aggregateStats?.expectedMove || 0,
          }]);
        }
      } catch (err) {
        console.warn('[Chain] Failed to load term structure', err);
        if (!cancelled) {
          setTermStructure([{
            expiration: chain.selectedExpiration,
            dte: chain.rows?.[0]?.dte || 0,
            atmIv: chain.aggregateStats?.atmIv || 0,
            expectedMove: chain.aggregateStats?.expectedMove || 0,
          }]);
        }
      }
    };

    loadStructure();
    return () => {
      cancelled = true;
    };
  }, [chain?.symbol, chain?.selectedExpiration]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (ticker.trim()) loadChain(ticker.trim().toUpperCase());
  };

  const filteredRows = useMemo(() => {
    if (!chain?.rows) return [];
    return chain.rows.filter((row) => {
      const selectedContract = selectedSide === 'call' ? row.call : row.put;
      const absDelta = Math.abs(selectedContract.delta || 0);
      const isLiquid = (selectedContract.liquidityScore || 0) >= 0.45 && (selectedContract.spreadPct || 1) <= maxSpreadPct;
      if (moneynessFilter === 'atm' && !row.isAtm) return false;
      if (moneynessFilter === 'itm' && !selectedContract.inTheMoney) return false;
      if (moneynessFilter === 'otm' && selectedContract.inTheMoney) return false;
      if (deltaFilter === 'deep_itm' && absDelta < 0.7) return false;
      if (deltaFilter === 'near' && (absDelta < 0.3 || absDelta >= 0.7)) return false;
      if (deltaFilter === 'otm' && absDelta >= 0.3) return false;
      if (liquidOnly && !isLiquid) return false;
      if (realOnly && (row.call.isSynthetic || row.put.isSynthetic)) return false;
      if ((row.call.volume || 0) < minVolume && (row.put.volume || 0) < minVolume) return false;
      if ((row.call.openInterest || 0) < minOi && (row.put.openInterest || 0) < minOi) return false;
      if ((row.call.spreadPct || 0) > maxSpreadPct && (row.put.spreadPct || 0) > maxSpreadPct) return false;
      return true;
    });
  }, [chain, deltaFilter, liquidOnly, maxSpreadPct, minOi, minVolume, moneynessFilter, realOnly, selectedSide]);

  const selectedRow = useMemo(() => {
    if (!filteredRows.length) return null;
    return filteredRows.find((row) => row.strike === selectedStrike) || filteredRows[0];
  }, [filteredRows, selectedStrike]);

  const selectedContract = selectedRow ? (selectedSide === 'call' ? selectedRow.call : selectedRow.put) : null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!chain?.rows?.length) return;
      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeElement.tagName)) return;
      const rows = filteredRows;
      if (rows.length === 0) return;
      const currentIndex = Math.max(0, rows.findIndex((row) => row.strike === selectedStrike));

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const nextRow = rows[Math.min(currentIndex + 1, rows.length - 1)];
        setSelectedStrike(nextRow.strike);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const prevRow = rows[Math.max(currentIndex - 1, 0)];
        setSelectedStrike(prevRow.strike);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSelectedSide('call');
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSelectedSide('put');
      } else if (event.key.toLowerCase() === 'v') {
        setViewMode('volatility');
      } else if (event.key.toLowerCase() === 's') {
        setViewMode('scanner');
      } else if (event.key.toLowerCase() === 't') {
        if (selectedContract && chain && onSelectContract) {
          onSelectContract(chain.symbol, chain.selectedExpiration, selectedContract, chain.currentPrice);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chain, filteredRows, onSelectContract, selectedContract, selectedStrike]);

  const scannerUniverse = useMemo(() => {
    return filteredRows.flatMap((row) => [row.call, row.put]).filter((contract) => {
      const marketPrice = contract.mid || contract.lastPrice || 0;
      return marketPrice >= 0.1
        && (contract.volume || 0) >= 50
        && (contract.openInterest || 0) >= 100
        && (contract.spreadPct || 1) <= 0.15;
    });
  }, [filteredRows]);

  const runScanner = async () => {
    if (!chain) return;
    setScanning(true);

    const atmIv = (chain.aggregateStats?.atmIv || 25) / 100;

    if (scannerMode === 'vertical') {
      // Vertical spread scanning: pair adjacent-strike same-type contracts
      const spreadResults: ScannerResult[] = [];
      const contractTypes: ContractSide[] = ['call', 'put'];

      for (const cType of contractTypes) {
        const typedContracts = scannerUniverse
          .filter(c => c.type === cType)
          .sort((a, b) => a.strike - b.strike);

        for (let i = 0; i < typedContracts.length - 1; i++) {
          const longLeg = typedContracts[i];
          const shortLeg = typedContracts[i + 1];

          const dteYears = Math.max((longLeg.dte || 1) / 365, 0.0001);
          const bsSigma = Math.max(atmIv, 0.0001);

          const longMarketPrice = longLeg.mid || longLeg.lastPrice || 0;
          const shortMarketPrice = shortLeg.mid || shortLeg.lastPrice || 0;

          const longBsPrice = calculateBlackScholes(longLeg.type, chain.currentPrice, longLeg.strike, dteYears, chain.rate || 0.05, bsSigma);
          const shortBsPrice = calculateBlackScholes(shortLeg.type, chain.currentPrice, shortLeg.strike, dteYears, chain.rate || 0.05, bsSigma);

          const marketSpreadCost = longMarketPrice - shortMarketPrice;
          const bsSpreadCost = longBsPrice - shortBsPrice;

          if (Math.abs(bsSpreadCost) < 0.01) continue;

          const edgeToBs = ((marketSpreadCost - bsSpreadCost) / Math.abs(bsSpreadCost)) * 100;
          const edgeToHeston = edgeToBs; // Heston not computed for spreads; reuse BS edge

          if (Math.abs(edgeToBs) < minEdgeThreshold) continue;

          const confidence = Math.max(1, Math.min(100, Math.round(
            Math.abs(edgeToBs) * 1.8
            + ((longLeg.liquidityScore || 0) * 35)
            + ((1 - Math.min(longLeg.spreadPct || 1, 1)) * 20)
            + ((1 - Math.min(Math.abs(longLeg.moneynessPct || 0), 1)) * 15)
          )));

          spreadResults.push({
            contract: longLeg, // primary display contract
            marketPrice: marketSpreadCost,
            bsPrice: bsSpreadCost,
            hestonPrice: bsSpreadCost,
            edgeToBs,
            edgeToHeston,
            confidence,
            recommendation: edgeToBs < 0 ? 'BUY' : 'SELL',
            spread: { longLeg, shortLeg },
          });
        }
      }

      spreadResults.sort((a, b) => (b.confidence + Math.abs(b.edgeToHeston)) - (a.confidence + Math.abs(a.edgeToHeston)));
      setScannerResults(spreadResults.slice(0, 12));
      setScanning(false);
      return;
    }

    // Single leg scanning
    const results = scannerUniverse.map((contract) => {
      const dteYears = Math.max((contract.dte || 1) / 365, 0.0001);
      const marketPrice = contract.mid || contract.lastPrice || 0;

      // BS with ATM IV (not contract-specific IV) to reveal actual skew/smile premium
      const bsSigma = Math.max(atmIv, 0.0001);
      const bsPrice = calculateBlackScholes(contract.type, chain.currentPrice, contract.strike, dteYears, chain.rate || 0.05, bsSigma);

      // Heston with calibrated per-ticker params
      const hestonPrice = calculateHestonPrice(
        contract.type,
        chain.currentPrice,
        contract.strike,
        dteYears,
        chain.rate || 0.05,
        atmIv * atmIv,
        atmIv * atmIv,
        hestonKappa,
        hestonXi,
        hestonRho
      );

      const edgeToBs = ((marketPrice - bsPrice) / Math.max(marketPrice, 0.01)) * 100;
      const edgeToHeston = ((marketPrice - hestonPrice) / Math.max(marketPrice, 0.01)) * 100;
      const confidence = Math.max(
        1,
        Math.min(
          100,
          Math.round(
            (Math.abs(edgeToHeston) * 1.8)
            + ((contract.liquidityScore || 0) * 35)
            + ((1 - Math.min(contract.spreadPct || 1, 1)) * 20)
            + ((1 - Math.min(Math.abs(contract.moneynessPct || 0), 1)) * 15)
          )
        )
      );
      return {
        contract,
        marketPrice,
        bsPrice,
        hestonPrice,
        edgeToBs,
        edgeToHeston,
        confidence,
        recommendation: edgeToHeston < 0 ? 'BUY' : 'SELL',
      } as ScannerResult;
    }).filter((result) => Math.abs(result.edgeToHeston) >= minEdgeThreshold);

    results.sort((a, b) => (b.confidence + Math.abs(b.edgeToHeston)) - (a.confidence + Math.abs(a.edgeToHeston)));
    setScannerResults(results.slice(0, 12));
    setScanning(false);
  };

  useEffect(() => {
    if (viewMode === 'scanner' && scannerResults.length === 0 && !scanning && chain) {
      runScanner();
    }
  }, [viewMode, chain, scannerUniverse.length]);

  const generateQuantMemo = async (result: ScannerResult) => {
    const contractKey = `${result.contract.contractSymbol || result.contract.strike}-${result.contract.type}`;
    setGeneratingMemo(contractKey);
    setQuantMemo(null);
    try {
      const session = createChatSession();
      const response = await session.sendMessage(`
        You are a senior derivatives strategist.
        Explain this option model deviation in at most 3 sentences.
        Ticker: ${chain?.symbol}
        Contract: ${getContractLabel(result.contract)}
        Market Mid: ${result.marketPrice.toFixed(2)}
        Black-Scholes: ${result.bsPrice.toFixed(2)}
        Heston: ${result.hestonPrice.toFixed(2)}
        Edge to Heston: ${result.edgeToHeston.toFixed(1)}%
        Liquidity Score: ${((result.contract.liquidityScore || 0) * 100).toFixed(0)}
        Mention whether skew, event risk, or liquidity premium likely explains it. End with confidence Low/Med/High.
      `);
      setQuantMemo({ id: `${result.contract.contractSymbol || result.contract.strike}-${result.contract.type}`, text: response.text });
    } catch (err) {
      console.error(err);
      setQuantMemo({ id: `${result.contract.strike}-${result.contract.type}`, text: t(language, 'chain.noKeyMemo') });
    } finally {
      setGeneratingMemo(null);
    }
  };

  const resetFilters = () => {
    setMoneynessFilter('all');
    setDeltaFilter('all');
    setLiquidOnly(false);
    setRealOnly(false);
    setMinVolume(0);
    setMinOi(0);
    setMaxSpreadPct(0.25);
  };

  const statusLabel = chain?.isSynthetic
    ? t(language, 'chain.simulated')
    : chain?.isDelayed
      ? t(language, 'chain.delayed')
      : t(language, 'chain.live');

  const renderGrid = () => (
    <div className="grid min-h-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr),340px]">
      <div data-testid="chain-grid-panel" className="min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{t(language, 'chain.gridView')}</div>
            <div className="mt-1 flex items-center gap-3 text-sm text-slate-300">
              <span>{chain?.symbol}</span>
              <span className="font-mono text-white">${chain?.currentPrice.toFixed(2)}</span>
              <span data-testid="chain-status-pill" className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${chain?.isSynthetic ? 'bg-slate-700 text-slate-200' : 'bg-emerald-500/15 text-emerald-300'}`}>{statusLabel}</span>
            </div>
          </div>
          <div className="flex gap-2 text-[11px] text-slate-400">
            <span>{t(language, 'chain.expectedMove')}: <span className="font-mono text-slate-200">${chain?.expectedMove?.toFixed(2)}</span></span>
            <span>{t(language, 'chain.atmIv')}: <span className="font-mono text-slate-200">{chain?.aggregateStats?.atmIv?.toFixed(1)}%</span></span>
          </div>
        </div>

        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(['all', 'atm', 'itm', 'otm'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setMoneynessFilter(filter)}
                className={`rounded-full border px-3 py-1 ${moneynessFilter === filter ? 'border-blue-400 bg-blue-500/20 text-blue-200' : 'border-white/10 text-slate-400'}`}
              >
                {filter === 'all' ? 'All' : filter.toUpperCase()}
              </button>
            ))}
            {(['all', 'deep_itm', 'near', 'otm'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setDeltaFilter(filter)}
                className={`rounded-full border px-3 py-1 ${deltaFilter === filter ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200' : 'border-white/10 text-slate-400'}`}
              >
                {filter === 'all' ? 'Δ All' : filter === 'deep_itm' ? 'Δ 0.7+' : filter === 'near' ? 'Δ 0.3-0.7' : 'Δ <0.3'}
              </button>
            ))}
            <button onClick={() => setLiquidOnly((value) => !value)} className={`rounded-full border px-3 py-1 ${liquidOnly ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200' : 'border-white/10 text-slate-400'}`}>{t(language, 'chain.liquidOnly')}</button>
            <button onClick={() => setRealOnly((value) => !value)} className={`rounded-full border px-3 py-1 ${realOnly ? 'border-amber-400 bg-amber-500/20 text-amber-200' : 'border-white/10 text-slate-400'}`}>{t(language, 'chain.realOnly')}</button>
            <button onClick={resetFilters} className="ml-auto text-slate-500 hover:text-white">{t(language, 'chain.clearFilters')}</button>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs text-slate-400">
              {t(language, 'chain.minVolume')}
              <input type="number" value={minVolume} min={0} onChange={(e) => setMinVolume(Number(e.target.value) || 0)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-400">
              {t(language, 'chain.minOi')}
              <input type="number" value={minOi} min={0} onChange={(e) => setMinOi(Number(e.target.value) || 0)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
            </label>
            <label className="text-xs text-slate-400">
              {t(language, 'chain.maxSpread')}
              <input type="number" value={Number((maxSpreadPct * 100).toFixed(0))} min={1} max={100} onChange={(e) => setMaxSpreadPct((Number(e.target.value) || 25) / 100)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
            </label>
          </div>
        </div>

        <div className="overflow-auto">
          <div className="min-w-[1780px]">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-slate-950/95 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-slate-500" style={{ display: 'grid', gridTemplateColumns: gridTemplate }}>
              <span className="text-right">Bid</span>
              <span className="text-right">Ask</span>
              <span className="text-right">Mid</span>
              <span className="text-right">{t(language, 'chain.spread')}</span>
              <span className="text-right">IV</span>
              <span className="text-right">Δ</span>
              <span className="text-right">Γ</span>
              <span className="text-right">Θ</span>
              <span className="text-right">Vol</span>
              <span className="text-right">OI</span>
              <span className="text-center">Strike</span>
              <span className="text-center">DTE</span>
              <span className="text-center">Money</span>
              <span className="text-left">Bid</span>
              <span className="text-left">Ask</span>
              <span className="text-left">Mid</span>
              <span className="text-left">{t(language, 'chain.spread')}</span>
              <span className="text-left">IV</span>
              <span className="text-left">Δ</span>
              <span className="text-left">Γ</span>
              <span className="text-left">Θ</span>
              <span className="text-left">Vol</span>
              <span className="text-left">OI</span>
            </div>

            {filteredRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-4 py-14 text-slate-500">
                <Layers className="mb-3 h-8 w-8 text-slate-700" />
                <p>{t(language, 'chain.noFilterMatch')}</p>
              </div>
            ) : filteredRows.map((row) => {
              const isSelectedRow = row.strike === selectedRow?.strike;
              const cellClass = (side: ContractSide) => {
                const active = isSelectedRow && selectedSide === side;
                return active ? 'bg-blue-500/10 text-white' : side === 'call' ? 'text-slate-200' : 'text-slate-300';
              };
              return (
                <button
                  key={row.strike}
                  type="button"
                  onClick={() => {
                    setSelectedStrike(row.strike);
                    setSelectedSide('call');
                  }}
                  data-testid={`chain-row-${row.strike.toFixed(2)}`}
                  className={`w-full border-b border-white/5 px-4 py-2 text-xs transition-colors ${row.isAtm ? 'bg-amber-500/5' : ''} ${isSelectedRow ? 'bg-white/5' : 'hover:bg-white/5'}`}
                  style={{ display: 'grid', gridTemplateColumns: gridTemplate }}
                >
                  <span className={`text-right ${cellClass('call')}`}>{row.call.bid.toFixed(2)}</span>
                  <span className={`text-right ${cellClass('call')}`}>{row.call.ask.toFixed(2)}</span>
                  <span className={`text-right ${cellClass('call')}`}>{(row.call.mid || 0).toFixed(2)}</span>
                  <span className={`text-right ${cellClass('call')}`}>{formatPct(row.call.spreadPct)}</span>
                  <span className={`text-right ${cellClass('call')}`}>{row.call.impliedVolatility.toFixed(1)}%</span>
                  <span className={`text-right ${cellClass('call')}`}>{formatSigned(row.call.delta, 2)}</span>
                  <span className={`text-right ${cellClass('call')}`}>{formatSigned(row.call.gamma, 4)}</span>
                  <span className={`text-right ${cellClass('call')}`}>{formatSigned(row.call.theta, 3)}</span>
                  <span className={`text-right ${cellClass('call')}`}>{row.call.volume.toLocaleString()}</span>
                  <span className={`text-right ${cellClass('call')}`}>{row.call.openInterest.toLocaleString()}</span>
                  <span className="text-center font-mono text-white">{row.strike.toFixed(2)}</span>
                  <span className="text-center text-slate-400">{row.dte}</span>
                  <span className={`text-center ${row.isAtm ? 'text-amber-300' : 'text-slate-500'}`}>{row.isAtm ? t(language, 'chain.atm') : `${(row.moneynessPct * 100).toFixed(1)}%`}</span>
                  <span className={`text-left ${cellClass('put')}`}>{row.put.bid.toFixed(2)}</span>
                  <span className={`text-left ${cellClass('put')}`}>{row.put.ask.toFixed(2)}</span>
                  <span className={`text-left ${cellClass('put')}`}>{(row.put.mid || 0).toFixed(2)}</span>
                  <span className={`text-left ${cellClass('put')}`}>{formatPct(row.put.spreadPct)}</span>
                  <span className={`text-left ${cellClass('put')}`}>{row.put.impliedVolatility.toFixed(1)}%</span>
                  <span className={`text-left ${cellClass('put')}`}>{formatSigned(row.put.delta, 2)}</span>
                  <span className={`text-left ${cellClass('put')}`}>{formatSigned(row.put.gamma, 4)}</span>
                  <span className={`text-left ${cellClass('put')}`}>{formatSigned(row.put.theta, 3)}</span>
                  <span className={`text-left ${cellClass('put')}`}>{row.put.volume.toLocaleString()}</span>
                  <span className={`text-left ${cellClass('put')}`}>{row.put.openInterest.toLocaleString()}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div data-testid="chain-inspector" className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.24em] text-slate-500">{t(language, 'chain.inspector')}</div>
            <div className="mt-1 text-sm font-semibold text-white">{selectedContract ? getContractLabel(selectedContract) : '--'}</div>
          </div>
          {selectedContract && (
            <div className={`rounded-full px-2 py-1 text-[10px] font-semibold ${selectedSide === 'call' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-rose-500/15 text-rose-300'}`}>
              {selectedSide.toUpperCase()}
            </div>
          )}
        </div>

        {selectedContract ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/5 bg-slate-900/80 p-3 text-xs">
              <div><div className="text-slate-500">{t(language, 'chain.provider')}</div><div className="mt-1 text-white">{chain?.provider}</div></div>
              <div><div className="text-slate-500">{t(language, 'chain.updated')}</div><div className="mt-1 text-white">{chain?.fetchedAt ? new Date(chain.fetchedAt).toLocaleTimeString() : '--'}</div></div>
              <div><div className="text-slate-500">Mid</div><div className="mt-1 font-mono text-white">${(selectedContract.mid || 0).toFixed(2)}</div></div>
              <div><div className="text-slate-500">{t(language, 'chain.spread')}</div><div className="mt-1 font-mono text-white">{formatPct(selectedContract.spreadPct)}</div></div>
              <div><div className="text-slate-500">{t(language, 'chain.intrinsic')}</div><div className="mt-1 font-mono text-white">${(selectedContract.intrinsicValue || 0).toFixed(2)}</div></div>
              <div><div className="text-slate-500">{t(language, 'chain.extrinsic')}</div><div className="mt-1 font-mono text-white">${(selectedContract.extrinsicValue || 0).toFixed(2)}</div></div>
              <div><div className="text-slate-500">{t(language, 'chain.breakeven')}</div><div className="mt-1 font-mono text-white">${(selectedContract.breakeven || 0).toFixed(2)}</div></div>
              <div><div className="text-slate-500">{t(language, 'chain.liquidity')}</div><div className="mt-1 font-mono text-white">{Math.round((selectedContract.liquidityScore || 0) * 100)}</div></div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-white/5 bg-slate-900/70 p-3"><div className="text-slate-500">Delta</div><div className="mt-1 font-mono text-white">{formatSigned(selectedContract.delta, 3)}</div></div>
              <div className="rounded-xl border border-white/5 bg-slate-900/70 p-3"><div className="text-slate-500">Gamma</div><div className="mt-1 font-mono text-white">{formatSigned(selectedContract.gamma, 4)}</div></div>
              <div className="rounded-xl border border-white/5 bg-slate-900/70 p-3"><div className="text-slate-500">Theta</div><div className="mt-1 font-mono text-white">{formatSigned(selectedContract.theta, 3)}</div></div>
              <div className="rounded-xl border border-white/5 bg-slate-900/70 p-3"><div className="text-slate-500">Vega</div><div className="mt-1 font-mono text-white">{formatSigned(selectedContract.vega, 3)}</div></div>
            </div>

            <div className="rounded-xl border border-white/5 bg-slate-900/70 p-3 text-xs text-slate-400">
              <div className="mb-2 flex items-center gap-2 text-slate-200"><Activity className="h-4 w-4" /> Model Snapshot</div>
              <div className="flex items-center justify-between"><span>Market Mid</span><span className="font-mono text-white">${(selectedContract.mid || 0).toFixed(2)}</span></div>
              <div className="mt-2 flex items-center justify-between"><span>Black-Scholes</span><span className="font-mono text-white">${selectedContract.theoreticalPrice?.toFixed(2) || '0.00'}</span></div>
              <div className="mt-2 flex items-center justify-between"><span>Expected Move</span><span className="font-mono text-white">${chain?.expectedMove?.toFixed(2) || '0.00'}</span></div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => chain && selectedContract && onSelectContract?.(chain.symbol, chain.selectedExpiration, selectedContract, chain.currentPrice)}
                data-testid="chain-inspector-trade"
                className="flex-1 rounded-xl border border-blue-500/30 bg-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-200"
              >
                {t(language, 'chain.trade')}
              </button>
              <button
                onClick={() => setSelectedSide(selectedSide === 'call' ? 'put' : 'call')}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300"
              >
                {selectedSide === 'call' ? 'View Put' : 'View Call'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] items-center justify-center text-sm text-slate-500">{t(language, 'chain.emptyTitle')}</div>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full w-full flex-col animate-fade-in">
      <NuxPageHeader eyebrow={t(language, 'common.nuxEyebrow')} title={t(language, 'chain.title')} subtitle={t(language, 'chain.subtitle')} />
      {error && <NuxNotice tone="danger">{error}</NuxNotice>}

      {quantMemo && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-8 backdrop-blur-sm">
          <div className="relative max-w-lg rounded-2xl border border-blue-500/40 bg-slate-900 p-6 shadow-2xl">
            <button onClick={() => setQuantMemo(null)} className="absolute right-4 top-4 text-slate-500 hover:text-white"><X className="h-5 w-5" /></button>
            <div className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-[0.24em] text-blue-300">
              <BrainCircuit className="h-5 w-5" /> AI Quant Memo
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{quantMemo.text}</p>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3 xl:justify-end">
          <div className="flex rounded-xl border border-white/10 bg-slate-900 p-1">
            {([
              ['grid', CandlestickChart, t(language, 'chain.gridView')],
              ['volatility', BarChart3, t(language, 'chain.volatilityView')],
              ['flow', Layers, t(language, 'chain.flowView')],
              ['scanner', Radar, t(language, 'chain.scannerView')],
              ['visual', Activity, t(language, 'chain.visualView')],
            ] as Array<[ViewMode, React.ComponentType<{ className?: string }>, string]>).map(([mode, Icon, label]) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                data-testid={`chain-view-${mode}`}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${viewMode === mode ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                title={label}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>

          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={ticker}
              onChange={(event) => {
                setTickerEdited(true);
                setTicker(event.target.value.toUpperCase());
              }}
              placeholder={t(language, 'chain.tickerPlaceholder')}
              className="w-32 rounded-xl border border-white/10 bg-slate-900 py-2 pl-10 pr-4 text-sm font-bold tracking-wide text-white"
            />
          </form>

          {chain && (
            <ExpirationCalendar
              expirations={chain.expirations}
              selectedExpiration={chain.selectedExpiration}
              onSelect={(expiration) => loadChain(chain.symbol, expiration)}
              language={language}
            />
          )}

          <button onClick={() => ticker.trim() && loadChain(ticker.trim().toUpperCase(), chain?.selectedExpiration)} className="rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-slate-300 hover:text-white">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3"><div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t(language, 'chain.expectedMove')}</div><div className="mt-2 text-lg font-semibold text-white">${chain?.aggregateStats?.expectedMove?.toFixed(2) || '0.00'}</div></div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3"><div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t(language, 'chain.maxPain')}</div><div className="mt-2 text-lg font-semibold text-white">${chain?.aggregateStats?.maxPain?.toFixed(2) || '0.00'}</div></div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3"><div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t(language, 'chain.putCallVolume')}</div><div className="mt-2 text-lg font-semibold text-white">{chain?.aggregateStats?.putCallVolumeRatio?.toFixed(2) || '0.00'}</div></div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3"><div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t(language, 'chain.putCallOi')}</div><div className="mt-2 text-lg font-semibold text-white">{chain?.aggregateStats?.putCallOiRatio?.toFixed(2) || '0.00'}</div></div>
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-3"><div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t(language, 'chain.netGex')}</div><div className="mt-2 text-lg font-semibold text-white">{(chain?.aggregateStats?.netGammaExposure || 0).toLocaleString()}</div></div>
      </div>

      <div className="relative min-h-0 flex-1 rounded-2xl border border-white/10 bg-slate-900/40 p-4 backdrop-blur-md">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        )}

        {!chain ? (
          <div className="flex h-full items-center justify-center text-slate-500">{t(language, 'chain.emptyBody')}</div>
        ) : viewMode === 'grid' ? renderGrid() : viewMode === 'volatility' ? (
          volView3D ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">{t(language, 'chain.volSurface') || '3D Volatility Surface'}</h3>
                  <p className="text-xs text-slate-400">{chain.symbol} ${chain.currentPrice.toFixed(2)} — IV {chain.aggregateStats?.atmIv?.toFixed(1) || '...'}%</p>
                </div>
                <button
                  onClick={() => setVolView3D(false)}
                  className="rounded-xl border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-white"
                >
                  <BarChart3 className="mr-1 inline h-3.5 w-3.5" />
                  {t(language, 'chain.view2D') || '2D View'}
                </button>
              </div>
              <div className="h-[480px] rounded-2xl overflow-hidden">
                <VolatilitySurface
                  volatility={(chain.aggregateStats?.atmIv || 25) / 100}
                  riskFreeRate={chain.rate || 0.05}
                  isCall={selectedSide === 'call'}
                  strikePrice={selectedStrike || chain.currentPrice}
                  chain={chain}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-end">
                <button
                  onClick={() => setVolView3D(true)}
                  className="rounded-xl border border-white/10 px-3 py-1.5 text-[11px] font-semibold text-slate-400 hover:text-white"
                >
                  <Box className="mr-1 inline h-3.5 w-3.5" />
                  {t(language, 'chain.view3D') || '3D Surface'}
                </button>
              </div>
              <ChainVolatilityPanel chain={chain} language={language} termStructure={termStructure} />
            </div>
          )
        ) : viewMode === 'flow' ? (
          <ChainFlowPanel chain={chain} language={language} />
        ) : viewMode === 'visual' ? (
          <OptionsChainVisualizer chain={chain} onSelectContract={(contract) => {
            setSelectedStrike(contract.strike);
            setSelectedSide(contract.type);
          }} />
        ) : (
          <div data-testid="chain-scanner-panel" className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm">
              <div>
                <div className="font-semibold text-white">{t(language, 'chain.scannerMode')}</div>
                <div className="text-xs text-slate-400">{chain.isSynthetic ? t(language, 'chain.scannerDemo') : `${scannerUniverse.length} contracts passed liquidity rules`}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-slate-900 rounded-lg p-0.5 border border-white/10">
                  <button
                    onClick={() => setScannerMode('single')}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${scannerMode === 'single' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    {t(language, 'chain.singleLegs') || 'Single Legs'}
                  </button>
                  <button
                    onClick={() => setScannerMode('vertical')}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition-colors ${scannerMode === 'vertical' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    {t(language, 'chain.verticalSpreads') || 'Verticals'}
                  </button>
                </div>
                <button onClick={() => setShowScannerSettings((v) => !v)} className={`rounded-xl border px-2 py-1.5 text-[10px] ${showScannerSettings ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200' : 'border-white/10 text-slate-500'}`}>
                  {t(language, 'chain.scannerSettings') || 'Settings'}
                </button>
                <button data-testid="chain-scanner-rerun" onClick={runScanner} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-300 hover:text-white">{t(language, 'chain.forceRescan')}</button>
              </div>
            </div>

            {showScannerSettings && (
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>Heston κ (Mean Reversion)</span>
                      <span className="text-indigo-300">{hestonKappa.toFixed(1)}</span>
                    </div>
                    <input type="range" min="0.1" max="5.0" step="0.1" value={hestonKappa} onChange={e => setHestonKappa(Number(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>Heston ξ (Vol of Vol)</span>
                      <span className="text-rose-300">{hestonXi.toFixed(2)}</span>
                    </div>
                    <input type="range" min="0.01" max="1.0" step="0.01" value={hestonXi} onChange={e => setHestonXi(Number(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>Heston ρ (Correlation)</span>
                      <span className="text-amber-300">{hestonRho.toFixed(2)}</span>
                    </div>
                    <input type="range" min="-0.99" max="0.99" step="0.01" value={hestonRho} onChange={e => setHestonRho(Number(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>{t(language, 'chain.minEdgeThreshold') || 'Min Edge %'}</span>
                      <span className="text-emerald-300">{minEdgeThreshold}%</span>
                    </div>
                    <input type="range" min="5" max="20" step="0.5" value={minEdgeThreshold} onChange={e => setMinEdgeThreshold(Number(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500">
                      <span>Max Spread Filter</span>
                      <span className="text-blue-300">{(maxScannerSpread * 100).toFixed(0)}%</span>
                    </div>
                    <input type="range" min="0.05" max="0.25" step="0.01" value={maxScannerSpread} onChange={e => setMaxScannerSpread(Number(e.target.value))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-400" />
                  </div>
                </div>
                <button onClick={resetHestonParams} className="rounded-xl border border-indigo-500/30 bg-indigo-500/15 px-3 py-1.5 text-[10px] font-semibold text-indigo-200 hover:bg-indigo-500/25">
                  {t(language, 'chain.resetCalibrated') || 'Reset to Calibrated'}
                </button>
              </div>
            )}

            {scanning ? (
              <div className="flex h-[420px] items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-rose-400">
                  <RefreshCw className="h-10 w-10 animate-spin" />
                  <span className="text-xs uppercase tracking-[0.24em]">Running Heston calibration</span>
                </div>
              </div>
            ) : scannerResults.length === 0 ? (
              <div className="flex h-[420px] flex-col items-center justify-center gap-3 text-slate-500">
                <Radar className="h-10 w-10 text-slate-700" />
                <p>{t(language, 'chain.scannerEmpty')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {scannerResults.map((result) => (
                  <div data-testid="chain-scanner-card" key={`${result.contract.contractSymbol || result.contract.strike}-${result.contract.type}`} className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${result.contract.type === 'call' ? 'bg-cyan-500/15 text-cyan-300' : 'bg-rose-500/15 text-rose-300'}`}>{result.contract.type.toUpperCase()}</div>
                        {result.spread ? (
                          <div className="mt-2 text-lg font-semibold text-white">
                            {getContractLabel(result.spread.longLeg)} / {getContractLabel(result.spread.shortLeg)}
                          </div>
                        ) : (
                          <div className="mt-2 text-lg font-semibold text-white">{getContractLabel(result.contract)}</div>
                        )}
                        <div className="text-xs text-slate-500">
                          {result.spread ? (
                            <span>{t(language, 'chain.verticalSpread') || 'Vertical Spread'}</span>
                          ) : (
                            <span>IV {result.contract.impliedVolatility.toFixed(1)}% | LQ {Math.round((result.contract.liquidityScore || 0) * 100)}</span>
                          )}
                        </div>
                      </div>
                      <div className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${result.recommendation === 'BUY' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                        {result.recommendation === 'BUY' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {result.recommendation}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 rounded-xl border border-white/5 bg-black/20 p-3 text-xs">
                      <div><div className="text-slate-500">{result.spread ? (t(language, 'chain.marketSpread') || 'Mkt Spread') : 'Market'}</div><div className="mt-1 font-mono text-white">${result.marketPrice.toFixed(2)}</div></div>
                      <div><div className="text-slate-500">{result.spread ? (t(language, 'chain.bsSpread') || 'BS Spread') : 'Black-Scholes'}</div><div className="mt-1 font-mono text-white">${result.bsPrice.toFixed(2)}</div></div>
                      <div><div className="text-slate-500">{result.spread ? (t(language, 'chain.spreadDiff') || 'Spread Diff') : 'Heston'}</div><div className="mt-1 font-mono text-white">{result.spread ? `${result.marketPrice - result.bsPrice > 0 ? '+' : ''}${(result.marketPrice - result.bsPrice).toFixed(2)}` : `$${result.hestonPrice.toFixed(2)}`}</div></div>
                      <div><div className="text-slate-500">Confidence</div><div className="mt-1 font-mono text-white">{result.confidence}</div></div>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>BS {formatSigned(result.edgeToBs, 1)}%</span>
                      <span>Heston {formatSigned(result.edgeToHeston, 1)}%</span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={() => generateQuantMemo(result)}
                        disabled={generatingMemo !== null}
                        className="flex-1 rounded-xl border border-blue-500/30 bg-blue-500/20 px-3 py-2 text-xs font-semibold text-blue-200 disabled:opacity-60"
                      >
                        {generatingMemo === `${result.contract.contractSymbol || result.contract.strike}-${result.contract.type}` ? (
                          <span className="flex items-center justify-center gap-1.5">
                            <RefreshCw className="h-3 w-3 animate-spin" />
                            {t(language, 'chain.generatingMemo') || 'Generating...'}
                          </span>
                        ) : (
                          t(language, 'chain.quantMemo')
                        )}
                      </button>
                      <button onClick={() => chain && onSelectContract?.(chain.symbol, chain.selectedExpiration, result.contract, chain.currentPrice)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-slate-200">
                        {t(language, 'chain.trade')} <ArrowRight className="ml-1 inline h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-xs text-slate-400">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-400" />
                <p>Scanner prioritizes contracts with real liquidity, compares market mid vs Black-Scholes and Heston, and de-emphasizes wide-spread or deep-wing contracts.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <RiskDisclaimer language={language} />
    </div>
  );
};

export default OptionsChainView;
