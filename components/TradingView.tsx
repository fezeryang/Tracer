
import React, { useState, useEffect } from 'react';
import { Wallet, TrendingUp, TrendingDown, Briefcase, RefreshCw, AlertCircle, ShoppingCart, Clock, Info, Zap } from 'lucide-react';
import { fetchAlpacaAccount, fetchAlpacaPositions, placeAlpacaOrder, fetchAlpacaClock } from '../services/tradingService';
import { AlpacaAccount } from '../types';
import { Language, t } from '../i18n';
import { NuxPageHeader, NuxNotice, RiskDisclaimer } from './NuxPage';

const TradingView: React.FC<{ language: Language }> = ({ language }) => {
    const [account, setAccount] = useState<AlpacaAccount | null>(null);
    const [positions, setPositions] = useState<any[]>([]);
    const [clock, setClock] = useState<{ is_open: boolean, timestamp: string, next_open: string, next_close: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Order State
    const [orderSymbol, setOrderSymbol] = useState('');
    const [orderQty, setOrderQty] = useState(1);
    const [orderSide, setOrderSide] = useState<'buy' | 'sell'>('buy');
    const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
    const [limitPrice, setLimitPrice] = useState<string>('');
    const [extendedHours, setExtendedHours] = useState(false);
    const [placingOrder, setPlacingOrder] = useState(false);
    const [orderStatus, setOrderStatus] = useState<{ success: boolean, message: string } | null>(null);

    const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [acc, pos, clk] = await Promise.all([
                fetchAlpacaAccount(),
                fetchAlpacaPositions(),
                fetchAlpacaClock()
            ]);
            setAccount(acc);
            setPositions(pos);
            setClock(clk);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const handlePlaceOrder = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderSymbol) return;
        
        setPlacingOrder(true);
        setOrderStatus(null);
        try {
            await placeAlpacaOrder({
                symbol: orderSymbol.toUpperCase(),
                qty: orderQty,
                side: orderSide,
                type: orderType,
                time_in_force: 'day',
                extended_hours: extendedHours,
                ...(orderType === 'limit' ? { limit_price: parseFloat(limitPrice) } : {})
            } as any);
            
            setOrderStatus({ success: true, message: `Order placed: ${orderSide.toUpperCase()} ${orderQty} ${orderSymbol.toUpperCase()}` });
            setOrderSymbol('');
            setLimitPrice('');
            loadData();
        } catch (e: any) {
            setOrderStatus({ success: false, message: e.message });
        } finally {
            setPlacingOrder(false);
        }
    };

    if (loading && !account) {
        return (
            <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <NuxPageHeader eyebrow={t(language, 'common.nuxEyebrow')} title={t(language, 'trade.title')} subtitle={t(language, 'trade.subtitle')} />
            {/* Market Status Banner */}
            {clock && (
                <div className={`flex items-center justify-between px-4 py-2 rounded-xl border ${clock.is_open ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                        <Clock className="w-4 h-4" />
                        Market is {clock.is_open ? 'Open' : 'Closed'}
                    </div>
                    <div className="text-[10px] opacity-80">
                        {clock.is_open ? `Closes at ${new Date(clock.next_close).toLocaleTimeString()}` : `Opens at ${new Date(clock.next_open).toLocaleTimeString()}`}
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl flex items-center gap-3 text-rose-400">
                    <AlertCircle className="w-5 h-5" />
                    <p className="text-sm font-medium">{error}</p>
                    <button onClick={loadData} className="ml-auto text-xs bg-rose-500/20 px-3 py-1 rounded-lg hover:bg-rose-500/30 transition-colors">{t(language, 'common.retry')}</button>
                </div>
            )}

            {error && <NuxNotice tone="warning">{t(language, 'trade.error')}</NuxNotice>}

            {orderStatus && (
                <div className={`p-4 rounded-xl flex items-center gap-3 border ${orderStatus.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                    {orderStatus.success ? <ShoppingCart className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <p className="text-sm font-medium">{orderStatus.message}</p>
                    <button onClick={() => setOrderStatus(null)} className="ml-auto text-xs opacity-50 hover:opacity-100">Dismiss</button>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Account Summary */}
                <div className="bg-slate-900/50 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Account Value</h3>
                            <p className="text-xs text-slate-500">Paper Trading Active</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <p className="text-3xl font-mono font-bold text-white">
                                ${account ? parseFloat(account.portfolio_value).toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
                            </p>
                            <div className="flex items-center gap-2 text-xs mt-1">
                                <span className="text-slate-500">Buying Power:</span>
                                <span className="text-emerald-400 font-mono">${account ? parseFloat(account.buying_power).toLocaleString() : '0'}</span>
                            </div>
                        </div>
                        
                        <div className="pt-4 border-t border-white/5 space-y-2">
                            <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                                <span>Cash</span>
                                <span className="text-slate-300">${account ? parseFloat(account.cash).toLocaleString() : '0'}</span>
                            </div>
                            <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                                <span>Equity</span>
                                <span className="text-slate-300">${account ? parseFloat(account.equity).toLocaleString() : '0'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Trade Execution */}
                <div className="lg:col-span-2 bg-slate-900/50 border border-white/5 p-6 rounded-2xl backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                <ShoppingCart className="w-5 h-5 text-emerald-400" />
                            </div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Execute Order</h3>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <input 
                                    type="checkbox" 
                                    checked={extendedHours} 
                                    onChange={(e) => setExtendedHours(e.target.checked)}
                                    className="sr-only"
                                />
                                <div className={`w-8 h-4 rounded-full transition-colors relative ${extendedHours ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                                    <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${extendedHours ? 'left-5' : 'left-1'}`}></div>
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-widest">EXT Hours</span>
                            </label>
                        </div>
                    </div>

                    <form onSubmit={handlePlaceOrder} className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Symbol</label>
                                <input 
                                    type="text" 
                                    value={orderSymbol}
                                    onChange={(e) => setOrderSymbol(e.target.value)}
                                    placeholder="AAPL"
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors uppercase font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Quantity</label>
                                <input 
                                    type="number" 
                                    value={orderQty}
                                    onChange={(e) => setOrderQty(parseInt(e.target.value))}
                                    min="1"
                                    className="w-full bg-slate-800 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Side</label>
                                <div className="flex bg-slate-800 p-1 rounded-xl border border-white/10 h-[42px]">
                                    <button 
                                        type="button"
                                        onClick={() => setOrderSide('buy')}
                                        className={`flex-1 rounded-lg text-[10px] font-bold transition-all ${orderSide === 'buy' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                    >BUY</button>
                                    <button 
                                        type="button"
                                        onClick={() => setOrderSide('sell')}
                                        className={`flex-1 rounded-lg text-[10px] font-bold transition-all ${orderSide === 'sell' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                    >SELL</button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-slate-500 uppercase font-bold">Type</label>
                                <div className="flex bg-slate-800 p-1 rounded-xl border border-white/10 h-[42px]">
                                    <button 
                                        type="button"
                                        onClick={() => setOrderType('market')}
                                        className={`flex-1 rounded-lg text-[10px] font-bold transition-all ${orderType === 'market' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                    >MKT</button>
                                    <button 
                                        type="button"
                                        onClick={() => setOrderType('limit')}
                                        className={`flex-1 rounded-lg text-[10px] font-bold transition-all ${orderType === 'limit' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                    >LMT</button>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row gap-4 items-end">
                            {orderType === 'limit' && (
                                <div className="w-full md:w-1/3 space-y-1.5 animate-fade-in">
                                    <label className="text-[10px] text-slate-500 uppercase font-bold">Limit Price</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={limitPrice}
                                            onChange={(e) => setLimitPrice(e.target.value)}
                                            placeholder="0.00"
                                            className="w-full bg-slate-800 border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-colors font-mono"
                                        />
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex-1 flex items-center gap-3 bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-xl">
                                <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                <p className="text-[10px] text-slate-400 leading-tight">
                                    {orderType === 'market' 
                                        ? "Market orders execute immediately at the best available price. Not available during extended hours."
                                        : "Limit orders only execute at your specified price or better. Required for extended hours trading."}
                                </p>
                            </div>

                            <button 
                                type="submit"
                                disabled={placingOrder || !orderSymbol || (orderType === 'limit' && !limitPrice)}
                                className="w-full md:w-1/4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-900/20 active:scale-95 flex items-center justify-center gap-2"
                            >
                                {placingOrder ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                {placingOrder ? 'Executing...' : 'Send Order'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Positions */}
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl backdrop-blur-sm overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Briefcase className="w-5 h-5 text-indigo-400" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Open Positions</h3>
                    </div>
                    <button onClick={loadData} className="text-slate-500 hover:text-white transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5">
                                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Asset</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Qty</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Market Value</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg Price</th>
                                <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">PnL</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {positions.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 text-sm italic">No open positions detected.</td>
                                </tr>
                            ) : (
                                positions.map((pos) => (
                                    <tr key={pos.symbol} className="hover:bg-white/5 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-bold">{pos.symbol}</span>
                                                <span className="text-[10px] text-slate-500 uppercase">{pos.asset_class}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm">{pos.qty}</td>
                                        <td className="px-6 py-4 font-mono text-sm">${parseFloat(pos.market_value).toLocaleString()}</td>
                                        <td className="px-6 py-4 font-mono text-sm">${parseFloat(pos.avg_entry_price).toLocaleString()}</td>
                                        <td className={`px-6 py-4 font-mono text-sm ${parseFloat(pos.unrealized_pnl) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            <div className="flex items-center gap-1">
                                                {parseFloat(pos.unrealized_pnl) >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                                ${parseFloat(pos.unrealized_pnl).toLocaleString()}
                                                <span className="text-[10px] opacity-70">({(parseFloat(pos.unrealized_pnl_pc) * 100).toFixed(2)}%)</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <RiskDisclaimer language={language} />
        </div>
    );
};

export default TradingView;
