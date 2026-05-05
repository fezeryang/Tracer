
import React, { useEffect, useState } from 'react';
import { AdminLog, RegisteredUser } from '../types';
import { ShieldCheck, Clock, Users, Database, UserPlus, List, Server, Terminal, CheckCircle, XCircle, Activity, Zap, Radio, Globe, BarChart2, AlertCircle } from 'lucide-react';
import { Language, t } from '../i18n';
import { NuxPageHeader } from './NuxPage';

const AdminDashboard: React.FC<{ language: Language }> = ({ language }) => {
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [view, setView] = useState<'sessions' | 'users' | 'diagnostics' | 'feeds'>('feeds');
  const [loading, setLoading] = useState(true);

  // Diagnostics State
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  // Provider State
  const [activeProvider, setActiveProvider] = useState('POLYGON');
  const [providerTests, setProviderTests] = useState<Record<string, { 
      status: 'idle' | 'success' | 'error', 
      latency: number, 
      msg: string,
      command?: string,
      rawResponse?: any
  }>>({
      'POLYGON': { status: 'idle', latency: 0, msg: '' },
      'FINNHUB': { status: 'idle', latency: 0, msg: '' },
      'YAHOO': { status: 'idle', latency: 0, msg: '' },
      'GOOGLE': { status: 'idle', latency: 0, msg: '' },
      'SIMULATION': { status: 'idle', latency: 0, msg: '' }
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [logsRes, usersRes, providerRes] = await Promise.all([
          fetch('/api/admin/logs'),
          fetch('/api/admin/users'),
          fetch('/api/admin/provider')
        ]);
        const logsData = await logsRes.json();
        const usersData = await usersRes.json();
        const provData = await providerRes.json();
        
        setLogs(logsData);
        setUsers(usersData);
        if(provData.provider) setActiveProvider(provData.provider);
      } catch (e) {
        console.error("Failed to load admin data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const runConnectionTest = async () => {
      setTesting(true);
      setTestResult(null);
      const start = Date.now();
      try {
          // Simulate CURL
          const res = await fetch('/api/quote/SPY');
          const data = await res.json();
          const latency = Date.now() - start;
          setTestResult({
              status: res.status,
              latency,
              data,
              url: `${window.location.origin}/api/quote/SPY`
          });
      } catch (e: any) {
          setTestResult({ error: e.message, status: 0 });
      } finally {
          setTesting(false);
      }
  };

  const testProvider = async (provider: string) => {
      const commandStr = `curl -X GET /api/admin/test/${provider}`;
      
      setProviderTests(prev => ({ 
          ...prev, 
          [provider]: { ...prev[provider], status: 'idle', command: commandStr, rawResponse: null } 
      }));
      
      try {
          const res = await fetch(`/api/admin/test/${provider}`);
          const data = await res.json();
          
          if (data.success) {
               setProviderTests(prev => ({ 
                   ...prev, 
                   [provider]: { 
                       status: 'success', 
                       latency: data.latency, 
                       msg: 'Connected',
                       command: commandStr,
                       rawResponse: data
                   } 
               }));
          } else {
               setProviderTests(prev => ({ 
                   ...prev, 
                   [provider]: { 
                       status: 'error', 
                       latency: 0, 
                       msg: data.error || 'Failed',
                       command: commandStr,
                       rawResponse: data
                   } 
               }));
          }
      } catch (e: any) {
          setProviderTests(prev => ({ 
               ...prev, 
               [provider]: { 
                   status: 'error', 
                   latency: 0, 
                   msg: 'Network Error',
                   command: commandStr,
                   rawResponse: { error: e.message }
               } 
           }));
      }
  };

  const activateProvider = async (provider: string) => {
      try {
          const res = await fetch('/api/admin/provider', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ provider })
          });
          const data = await res.json();
          if (data.success) {
              setActiveProvider(data.provider);
          }
      } catch (e) {
          console.error(e);
      }
  };

  const renderProviderCard = (key: string, label: string, desc: string, Icon: any, colorClass: string, isSim: boolean = false) => {
      const testData = providerTests[key];

      return (
      <div className={`p-6 rounded-2xl border ${activeProvider === key ? 'bg-indigo-600/10 border-indigo-500/50' : 'bg-slate-900/60 border-white/10'}`}>
        <div className="flex justify-between items-start mb-4">
            <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${colorClass} bg-opacity-20`}>
                    <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
                </div>
                <div>
                    <h3 className="font-bold text-white text-lg">{label}</h3>
                    <p className="text-xs text-slate-400">{desc}</p>
                </div>
            </div>
            {activeProvider === key && (
                <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase rounded-lg border border-emerald-500/30">Active</span>
            )}
        </div>
        
        <div className="space-y-4">
            <div className="text-xs bg-black/40 p-3 rounded-lg font-mono text-slate-400 border border-white/5 flex justify-between">
                <span>{isSim ? 'Mock / Simulation' : 'API Key Configured'}</span>
                {testData.status === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>}
            </div>

            <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400">Status</span>
                {testData.status === 'success' ? (
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> {testData.latency}ms
                    </span>
                ) : testData.status === 'error' ? (
                    <span className="text-rose-400 font-bold flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Error
                    </span>
                ) : (
                    <span className="text-slate-600">Untested</span>
                )}
            </div>

            {/* Test Console */}
            {testData.command && (
                <div className="bg-slate-950/80 rounded-lg border border-white/10 p-3 space-y-2 animate-fade-in">
                    <div className="flex items-center gap-2 border-b border-white/5 pb-2 mb-1">
                        <Terminal className="w-3 h-3 text-slate-500" />
                        <span className="text-[10px] font-bold uppercase text-slate-500">Diagnostics</span>
                    </div>
                    
                    <div className="space-y-1">
                        <div className="text-[9px] text-indigo-400 font-mono break-all">
                            <span className="text-slate-600">$</span> {testData.command}
                        </div>
                        {testData.rawResponse && (
                            <pre className={`text-[9px] font-mono p-2 rounded bg-black/50 overflow-x-auto scrollbar-hide max-h-32 border border-white/5 ${testData.status === 'error' ? 'text-rose-300' : 'text-emerald-300'}`}>
                                {JSON.stringify(testData.rawResponse, null, 2)}
                            </pre>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
                    <button 
                    onClick={() => testProvider(key)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all"
                    >
                        Test Connection
                    </button>
                    <button 
                    onClick={() => activateProvider(key)}
                    disabled={activeProvider === key}
                    className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeProvider === key ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                    >
                        {activeProvider === key ? 'Running' : 'Activate'}
                    </button>
            </div>
        </div>
      </div>
      );
  };

  return (
    <div className="animate-fade-in w-full pb-10">
       <NuxPageHeader eyebrow={t(language, 'common.nuxEyebrow')} title={t(language, 'admin.title')} subtitle={t(language, 'admin.subtitle')} />
       <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-900/60 p-6 rounded-2xl border border-white/10 backdrop-blur-md gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                {t(language, 'admin.title')}
            </h2>
            <p className="text-slate-400 text-sm">{t(language, 'admin.subtitle')}</p>
          </div>
          
          <div className="flex flex-wrap gap-4 items-center">
              <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5">
                 <button 
                    onClick={() => setView('feeds')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${view === 'feeds' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                 >
                    <Radio className="w-3.5 h-3.5" /> {t(language, 'admin.dataFeeds')}
                 </button>
                 <button 
                    onClick={() => setView('sessions')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${view === 'sessions' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                 >
                    <List className="w-3.5 h-3.5" /> {t(language, 'admin.sessions')}
                 </button>
                 <button 
                    onClick={() => setView('users')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${view === 'users' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                 >
                    <UserPlus className="w-3.5 h-3.5" /> {t(language, 'admin.registry')}
                 </button>
                 <button 
                    onClick={() => setView('diagnostics')}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${view === 'diagnostics' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                 >
                    <Terminal className="w-3.5 h-3.5" /> {t(language, 'admin.diagnostics')}
                 </button>
              </div>
          </div>
       </div>

       {view === 'feeds' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fade-in">
                {renderProviderCard('POLYGON', 'Polygon.io', 'Primary Aggregator', Activity, 'bg-violet-600', false)}
                {renderProviderCard('FINNHUB', 'Finnhub.io', 'Global Market Data', Globe, 'bg-emerald-600', false)}
                {renderProviderCard('YAHOO', 'Yahoo Finance', 'Public Query API', BarChart2, 'bg-purple-600', true)}
                {renderProviderCard('GOOGLE', 'Google Finance', 'Web Scraper (Simulated)', Globe, 'bg-blue-600', true)}
                {renderProviderCard('SIMULATION', 'Simulation', 'Mock Data Generator', Zap, 'bg-slate-700', true)}
           </div>
       )}

       {view === 'diagnostics' && (
           <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
               <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                   <Server className="w-5 h-5 text-indigo-400" /> 
                   Server Connectivity Check
               </h3>
               <p className="text-sm text-slate-400 mb-6">
                   Verify that the NUX server is correctly proxying market data from Alpaca/Yahoo and not relying on client-side simulation.
               </p>

               <div className="bg-black/50 rounded-xl border border-white/10 p-6 font-mono text-sm shadow-inner">
                   <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/5">
                       <span className="text-green-400 font-bold">$</span>
                       <span className="text-slate-300">curl -X GET</span>
                       <span className="text-blue-400">{window.location.origin}/api/quote/SPY</span>
                       <button 
                           onClick={runConnectionTest} 
                           disabled={testing}
                           className="ml-auto bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wide transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg shadow-indigo-500/20"
                       >
                           {testing ? 'Executing...' : 'Run Test'}
                       </button>
                   </div>

                   {testResult ? (
                       <div className="animate-fade-in space-y-4">
                           <div className="flex gap-6 text-xs uppercase font-bold tracking-wider">
                               <div className={`flex items-center gap-2 ${testResult.status === 200 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                   {testResult.status === 200 ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                                   HTTP {testResult.status}
                               </div>
                               <div className="text-amber-400 flex items-center gap-2">
                                   <Clock className="w-4 h-4" />
                                   {testResult.latency}ms
                               </div>
                           </div>
                           
                           <div className="space-y-1">
                               <div className="text-slate-500 text-xs">Response Body:</div>
                               <pre className="text-slate-300 bg-slate-900/50 p-4 rounded-lg border border-white/5 overflow-x-auto">
                                   {JSON.stringify(testResult.data, null, 2)}
                               </pre>
                           </div>

                           {testResult.data?.source && (
                               <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-300 text-xs flex items-center gap-2">
                                   <Server className="w-4 h-4" />
                                   Verified Data Source: <strong className="text-white">{testResult.data.source}</strong>
                               </div>
                           )}
                       </div>
                   ) : (
                       <div className="text-slate-600 italic py-8 text-center">
                           // Waiting for user command...
                       </div>
                   )}
               </div>
           </div>
       )}

       {(view === 'sessions' || view === 'users') && (
           <div className="bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl">
               <div className="overflow-x-auto">
                   {view === 'sessions' ? (
                       <table className="w-full text-left border-collapse">
                           <thead>
                               <tr className="bg-slate-950 text-[10px] uppercase font-bold text-slate-500 border-b border-white/5">
                                   <th className="p-4">Operator Callsign</th>
                                   <th className="p-4">Login Timestamp</th>
                                   <th className="p-4">Last Active</th>
                                   <th className="p-4">Duration</th>
                                   <th className="p-4">IP Address</th>
                                   <th className="p-4">Status</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                               {loading ? (
                                   <tr><td colSpan={6} className="p-8 text-center text-slate-500">Decrypting Logs...</td></tr>
                               ) : logs.map((log, idx) => {
                                   const isOnline = (Date.now() - new Date(log.lastActive).getTime()) < 2 * 60 * 1000; // < 2 mins ago
                                   return (
                                       <tr key={idx} className="hover:bg-white/5 transition-colors">
                                           <td className="p-4 font-mono font-bold text-white flex items-center gap-2">
                                               <Users className="w-3.5 h-3.5 text-indigo-400" />
                                               {log.username}
                                           </td>
                                           <td className="p-4 text-slate-400 text-xs">
                                               {new Date(log.loginTime).toLocaleString()}
                                           </td>
                                           <td className="p-4 text-slate-400 text-xs">
                                               {new Date(log.lastActive).toLocaleTimeString()}
                                           </td>
                                           <td className="p-4 font-mono text-amber-400 font-medium">
                                               {log.durationMinutes} min
                                           </td>
                                           <td className="p-4 text-slate-500 text-xs font-mono">
                                                {log.ipAddress || 'Unknown'}
                                           </td>
                                           <td className="p-4">
                                               {isOnline ? (
                                                   <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold uppercase border border-emerald-500/20">
                                                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Online
                                                   </span>
                                               ) : (
                                                   <span className="text-slate-600 text-[10px] uppercase font-bold">Offline</span>
                                               )}
                                           </td>
                                       </tr>
                                   );
                               })}
                           </tbody>
                       </table>
                   ) : (
                       <table className="w-full text-left border-collapse">
                           <thead>
                               <tr className="bg-slate-950 text-[10px] uppercase font-bold text-slate-500 border-b border-white/5">
                                   <th className="p-4">Callsign</th>
                                   <th className="p-4">Secure Email</th>
                                   <th className="p-4">Registration Date</th>
                                   <th className="p-4">Reg IP</th>
                               </tr>
                           </thead>
                           <tbody className="divide-y divide-white/5 text-sm text-slate-300">
                               {loading ? (
                                   <tr><td colSpan={4} className="p-8 text-center text-slate-500">Loading Registry...</td></tr>
                               ) : users.map((u, idx) => (
                                   <tr key={idx} className="hover:bg-white/5 transition-colors">
                                       <td className="p-4 font-mono font-bold text-white">{u.username}</td>
                                       <td className="p-4 font-mono text-slate-400">{u.email}</td>
                                       <td className="p-4 text-slate-500 text-xs">{new Date(u.created_at).toLocaleString()}</td>
                                       <td className="p-4 text-slate-500 text-xs font-mono">{u.ipAddress || 'Unknown'}</td>
                                   </tr>
                               ))}
                           </tbody>
                       </table>
                   )}
               </div>
           </div>
       )}
    </div>
  );
};

export default AdminDashboard;
