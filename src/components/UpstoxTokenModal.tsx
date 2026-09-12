import React, { useState } from 'react';
import { UpstoxBrokerStatus } from '../types/trading';
import { ShieldCheck, Zap, Key, CheckCircle, AlertTriangle, ExternalLink, X, RefreshCw } from 'lucide-react';

interface UpstoxTokenModalProps {
  isOpen: boolean;
  onClose: () => void;
  status?: UpstoxBrokerStatus;
  currentStatus?: UpstoxBrokerStatus;
  onUpdateToken?: (token: string) => Promise<boolean>;
  onTokenUpdated?: (newStatus: UpstoxBrokerStatus) => void;
  onRefreshStatus?: () => void;
}

export const UpstoxTokenModal: React.FC<UpstoxTokenModalProps> = ({
  isOpen,
  onClose,
  status,
  currentStatus,
  onUpdateToken,
  onTokenUpdated,
  onRefreshStatus,
}) => {
  const [inputToken, setInputToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  if (!isOpen) return null;

  const activeStatus: UpstoxBrokerStatus = status || currentStatus || {
    connected: false,
    mode: 'SIMULATION',
    hasToken: false,
    feedLatencyMs: 4,
    marketOpen: true,
    brokerName: 'Upstox Pro API v2 (Simulation Mode)',
    clientName: 'Institutional Prop Trader',
    userId: 'UPX-PAPER-001',
    tokenMasked: '',
    balance: 1000000.0,
    utilizedMargin: 0,
    availableMargin: 1000000.0,
  };

  const handleUpdate = async (token: string): Promise<boolean> => {
    if (onUpdateToken) {
      return await onUpdateToken(token);
    }
    try {
      const res = await fetch('/api/upstox/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (onRefreshStatus) {
        onRefreshStatus();
      }
      if (onTokenUpdated && data) {
        onTokenUpdated(data);
      }
      return Boolean(data?.success);
    } catch {
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const ok = await handleUpdate(inputToken.trim());
      if (ok) {
        setFeedback({
          type: 'success',
          message: 'Upstox Pro analytical access token verified & connected for live trading!',
        });
        setInputToken('');
        if (onRefreshStatus) onRefreshStatus();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setFeedback({
          type: 'error',
          message: 'Upstox API rejected this token. Please check validity or generate a fresh access token.',
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Network error communicating with Upstox API endpoint.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClearToken = async () => {
    setLoading(true);
    await handleUpdate('');
    if (onRefreshStatus) onRefreshStatus();
    setLoading(false);
    setFeedback({
      type: 'info',
      message: 'Token cleared. Switched to Simulation Mode.',
    });
  };

  const handleSetMode = async (newMode: 'LIVE' | 'SIMULATION') => {
    setLoading(true);
    try {
      const res = await fetch('/api/upstox/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      });
      const data = await res.json();
      if (data?.success) {
        setFeedback({
          type: 'success',
          message: `Switched execution mode to ${newMode}!`,
        });
        if (onRefreshStatus) onRefreshStatus();
      }
    } catch {
      setFeedback({
        type: 'error',
        message: 'Failed to switch execution mode.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-xl border border-slate-700/80 bg-[#0f141f] p-6 shadow-2xl shadow-cyan-950/50 text-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-mono text-base font-bold text-slate-100 uppercase tracking-wide flex items-center gap-2">
              Upstox Pro API v2 Integration
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                activeStatus.connected && activeStatus.mode === 'LIVE'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>
                {activeStatus.connected && activeStatus.mode === 'LIVE' ? 'LIVE BROKER CONNECTED' : 'SIMULATION MODE'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Live token connected directly to Upstox Pro API v2 for real-time market data & order execution.
            </p>
          </div>
        </div>

        {/* Execution Mode Selector */}
        <div className="mb-4 flex items-center justify-between p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 font-mono">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-bold">TERMINAL EXECUTION ROUTE</span>
            <span className="text-slate-200 text-xs font-semibold">
              {activeStatus.mode === 'LIVE' ? 'LIVE UPSTOX BROKER ROUTING' : 'INTERNAL PAPER SIMULATION'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-md border border-slate-800">
            <button
              type="button"
              onClick={() => handleSetMode('LIVE')}
              disabled={loading}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeStatus.mode === 'LIVE'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'text-slate-400 hover:text-emerald-300'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${activeStatus.mode === 'LIVE' ? 'bg-slate-950' : 'bg-emerald-400 animate-pulse'}`} />
              LIVE BROKER
            </button>
            <button
              type="button"
              onClick={() => handleSetMode('SIMULATION')}
              disabled={loading}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeStatus.mode !== 'LIVE'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-amber-300'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${activeStatus.mode !== 'LIVE' ? 'bg-slate-950' : 'bg-amber-400'}`} />
              PAPER DESK
            </button>
          </div>
        </div>

        {/* Status Card */}
        <div className="mb-5 rounded-lg border border-slate-800 bg-[#0a0d14] p-4 font-mono text-xs">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">BROKER STATUS</span>
              <span className="font-semibold text-slate-200">{activeStatus.brokerName || 'Upstox Pro Live v2'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">ACTIVE CLIENT</span>
              <span className="font-semibold text-cyan-300">{activeStatus.clientName || 'Upstox Pro Trader'} ({activeStatus.userId || 'UPX-LIVE'})</span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">AVAILABLE CAPITAL</span>
              <span className="font-bold text-emerald-400">
                ₹{(activeStatus.availableMargin ?? 1000000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase text-slate-500 block">TOKEN STATUS</span>
              <span className={activeStatus.hasToken ? 'text-emerald-400' : 'text-slate-400'}>
                {activeStatus.tokenMasked || 'No live token set (Paper Mode)'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${activeStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              Live Feed: <strong className="text-emerald-400">{activeStatus.liveFeed || 'Upstox Pro v2 Stream'}</strong>
            </span>
            <button
              onClick={onRefreshStatus}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* Token Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-cyan-400" />
                Upstox Pro API v2 Access Token (Bearer Token)
              </span>
              <a
                href="https://developer.upstox.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <span>Upstox Developer Portal</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </label>
            <input
              type="password"
              value={inputToken}
              onChange={(e) => setInputToken(e.target.value)}
              placeholder="Paste your Upstox v2 access token here to switch or refresh..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 font-mono text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Generated daily from your Upstox Developer App login. When saved, all quotes and trades run live on Upstox.
            </p>
          </div>

          {feedback && (
            <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : feedback.type === 'error'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {activeStatus.hasToken && (
              <button
                type="button"
                onClick={handleClearToken}
                disabled={loading}
                className="px-3 py-2 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10 transition-colors"
              >
                Disconnect & Use Paper Mode
              </button>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !inputToken.trim()}
                className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-cyan-500/20"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5" />
                    <span>Connect Live Upstox</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
