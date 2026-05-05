
import React, { useState } from 'react';
import { Zap, Lock, Mail, LogIn } from 'lucide-react';
import { UserSession } from '../types';

interface LoginOverlayProps {
  onLogin: (session: UserSession) => void;
}

const LoginOverlay: React.FC<LoginOverlayProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    // 1. Create Session Immediately (Client-side)
    // We do not wait for the server. This ensures the user is never stuck.
    const session: UserSession = {
        username: username,
        sessionId: Date.now().toString(),
        loginTime: new Date().toISOString()
    };

    // 2. Grant Access Immediately
    onLogin(session);

    // 3. Log to backend in background (Fire & Forget)
    // This allows the Admin Dashboard to still collect data if the backend is reachable,
    // but doesn't block the user if it fails.
    if (username && email) {
        fetch('/api/auth/access', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email })
        }).catch(err => console.warn("Background logging failed - proceeding anyway", err));
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#050b14] flex flex-col items-center justify-center p-4">
       <div className="max-w-md w-full animate-fade-in relative">
           
           {/* Decorator */}
           <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full pointer-events-none"></div>

           <div className="bg-slate-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative overflow-hidden transition-all duration-300">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500"></div>

               <div className="text-center mb-8">
                   <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-600/30">
                       <Zap className="w-6 h-6 text-white fill-white" />
                   </div>
                   <h1 className="text-2xl font-bold text-white tracking-tight">NUX // Financial Intelligence Terminal</h1>
                   <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mt-1">
                       AI Financial Research Terminal
                   </p>
                   <p className="text-slate-400 text-sm mt-4">
                       Enter Callsign to Initialize
                   </p>
               </div>

               <form onSubmit={handleSubmit} className="space-y-4">
                   <div className="relative group">
                       <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                           <Lock className="h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                       </div>
                       <input 
                           type="text" 
                           value={username}
                           onChange={(e) => setUsername(e.target.value)}
                           className="w-full bg-slate-950 border border-white/10 rounded-xl py-3.5 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-mono"
                           placeholder="OPERATOR CALLSIGN"
                           autoFocus
                       />
                   </div>

                   <div className="relative group">
                       <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                           <Mail className="h-4 w-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                       </div>
                       <input 
                           type="email" 
                           value={email}
                           onChange={(e) => setEmail(e.target.value)}
                           className="w-full bg-slate-950 border border-white/10 rounded-xl py-3.5 pl-10 pr-4 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-all font-mono"
                           placeholder="EMAIL (OPTIONAL)"
                       />
                   </div>
                   
                   <button 
                       type="submit" 
                       disabled={!username.trim()}
                       className="w-full bg-white text-slate-950 font-bold py-3.5 rounded-xl hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                   >
                       Initialize Terminal <LogIn className="w-4 h-4" />
                   </button>
               </form>

               <div className="mt-6 text-center">
                   <p className="text-[10px] text-slate-600 font-mono uppercase tracking-widest">
                       Bypassing Security Protocols...
                   </p>
               </div>
           </div>
       </div>
    </div>
  );
};

export default LoginOverlay;
