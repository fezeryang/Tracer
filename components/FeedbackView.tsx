import React, { useState } from 'react';
import { Send, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { Language, t } from '../i18n';
import { NuxPageHeader } from './NuxPage';

const FeedbackView: React.FC<{ language: Language }> = ({ language }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to transmit');

      setStatus('success');
      setFormData({ name: '', email: '', message: '' });
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      setStatus('error');
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in pb-10">
      <NuxPageHeader eyebrow={t(language, 'common.nuxEyebrow')} title={t(language, 'feedback.title')} subtitle={t(language, 'feedback.subtitle')} />
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium uppercase tracking-wider mb-4">
           <MessageSquare className="w-3 h-3" /> {t(language, 'feedback.systemFeedback')}
        </div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">{t(language, 'feedback.title')}</h2>
        <p className="text-slate-400">{t(language, 'feedback.subtitle')}</p>
      </div>

      <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20"></div>

        {status === 'success' ? (
          <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">{t(language, 'feedback.successTitle')}</h3>
            <p className="text-slate-400 text-center">{t(language, 'feedback.successBody')}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t(language, 'feedback.nameLabel')}</label>
                <input 
                  type="text" 
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder-slate-600"
                  placeholder={t(language, 'feedback.namePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t(language, 'feedback.emailLabel')}</label>
                <input 
                  type="email" 
                  required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder-slate-600"
                  placeholder={t(language, 'feedback.emailPlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">{t(language, 'feedback.messageLabel')}</label>
              <textarea 
                required
                value={formData.message}
                onChange={e => setFormData({...formData, message: e.target.value})}
                rows={6}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all placeholder-slate-600 resize-none"
                placeholder={t(language, 'feedback.messagePlaceholder')}
              />
            </div>

            <div className="pt-2">
              <button 
                type="submit" 
                disabled={status === 'submitting'}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === 'submitting' ? (
                  <>{t(language, 'feedback.submitting')}</>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> {t(language, 'feedback.submit')}
                  </>
                )}
              </button>
            </div>
            
            {status === 'error' && (
              <div className="flex items-center gap-2 text-rose-400 text-sm bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                <AlertCircle className="w-4 h-4" />
                {t(language, 'feedback.error')}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default FeedbackView;
