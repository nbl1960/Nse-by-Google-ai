import React from 'react';
import { AssetSymbol, AccountStats, UpstoxBrokerStatus, INSTRUMENT_METAS } from '../types/trading';
import { 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ShieldCheck, 
  Zap,
  Activity,
  Key,
  Flame,
  Layers
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface HeaderProps {
  selectedAsset: AssetSymbol;
  onSelectAsset: (asset: AssetSymbol) => void;
  assetPrices: Record<AssetSymbol, number>;
  assetChanges: Record<AssetSymbol, number>;
  indiaVix: number;
  indiaVixChange: number;
  fiiDiiNetCr?: number;
  accountStats: AccountStats;
  onResetAccount: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  activeKillzone: string;
  upstoxStatus?: UpstoxBrokerStatus;
  onOpenUpstoxModal: () => void;
}

const safeFixed = (val: number | undefined | null, digits: number = 2, fallback: string = '0.00'): string => {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return val.toFixed(digits);
};

export const Header: React.FC<HeaderProps> = ({
  selectedAsset,
  onSelectAsset,
  assetPrices,
  assetChanges,
  indiaVix,
  indiaVixChange,
  fiiDiiNetCr = 939.7,
  accountStats,
  onResetAccount,
  soundEnabled,
  onToggleSound,
  activeKillzone,
  upstoxStatus = {
    connected: true,
    mode: 'LIVE',
    hasToken: true,
    feedLatencyMs: 4,
    marketOpen: true,
  },
  onOpenUpstoxModal,
}) => {
  const isUpstoxConnected = Boolean(upstoxStatus?.connected && upstoxStatus?.mode === 'LIVE');
  const primarySymbols: AssetSymbol[] = [
    'NIFTY 50',
    'BANKNIFTY',
    'SENSEX',
    'RELIANCE',
    'HDFCBANK',
    'TCS',
    'INFY',
    'ICICIBANK',
    'TATAMOTORS',
    'MARUTI',
  ];

  const currentPrice = assetPrices[selectedAsset] || 0;
  const currentChange = assetChanges[selectedAsset] || 0;

  return (
    <header className="border-b border-slate-800/80 bg-[#0c1017] px-4 py-2.5 text-xs select-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Market Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-black tracking-tighter shadow-sm shadow-cyan-950">
              <Zap className="h-4 w-4 fill-cyan-400 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-extrabold text-sm tracking-wider text-slate-100 uppercase">
                  UPSTOX <span className="text-cyan-400">//</span> INSTITUTIONAL
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  NSE/BSE LIVE
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
                <span>DMA CO-LOCATION</span>
                <span className="text-slate-600">|</span>
                <span>TICK LATENCY: 4ms</span>
              </div>
            </div>
          </div>

          {/* Upstox Live Connection Button */}
          <button
            onClick={onOpenUpstoxModal}
            className={`flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-mono border transition-all ${
              isUpstoxConnected
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
            }`}
            title="Configure Upstox Live Token and Execution Mode"
          >
            <Key className="h-3.5 w-3.5" />
            <div className="text-left">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">UPSTOX PRO API</div>
              <div className="font-bold flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${isUpstoxConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {isUpstoxConnected ? 'LIVE CONNECTED' : 'SIMULATION MODE'}
              </div>
            </div>
          </button>

          {/* India VIX Badge */}
          <div className="hidden xl:flex items-center gap-2 rounded-md bg-slate-900/90 border border-slate-800 px-2.5 py-1 text-slate-300 font-mono">
            <Activity className="h-3.5 w-3.5 text-purple-400" />
            <div>
              <div className="text-[9px] text-slate-400 uppercase font-semibold">INDIA VIX</div>
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-100">{safeFixed(indiaVix, 2, '13.80')}</span>
                <span className={`text-[10px] ${(indiaVixChange || 0) <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(indiaVixChange || 0) > 0 ? '+' : ''}{safeFixed(indiaVixChange, 2, '0.00')}%
                </span>
              </div>
            </div>
          </div>

          {/* FII / DII Institutional Flow */}
          <div className="hidden 2xl:flex items-center gap-2 rounded-md bg-slate-900/90 border border-slate-800 px-2.5 py-1 text-slate-300 font-mono">
            <Flame className="h-3.5 w-3.5 text-cyan-400" />
            <div>
              <div className="text-[9px] text-slate-400 uppercase font-semibold">FII / DII FLOW</div>
              <div className="font-bold text-emerald-400">
                +{fiiDiiNetCr.toLocaleString('en-IN')} Cr (Net Buy)
              </div>
            </div>
          </div>

          {/* Trading Session / Killzone */}
          <div className="hidden lg:flex items-center gap-2 rounded-md bg-slate-900/90 border border-slate-800 px-2.5 py-1 text-slate-300 font-mono">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <div>
              <div className="text-[9px] text-slate-400 uppercase font-semibold">MARKET SESSION</div>
              <div className="font-medium text-slate-200">{activeKillzone}</div>
            </div>
          </div>
        </div>

        {/* Indian Market Instrument Switcher Bar */}
        <div className="flex items-center gap-1 overflow-x-auto max-w-full bg-slate-900/90 p-1 rounded-lg border border-slate-800 scrollbar-thin">
          {primarySymbols.map((sym) => {
            const isSelected = selectedAsset === sym;
            const price = assetPrices[sym] || INSTRUMENT_METAS[sym]?.basePrice || 0;
            const chg = assetChanges[sym] || 0;
            const meta = INSTRUMENT_METAS[sym];

            return (
              <button
                key={sym}
                id={`select-${sym.toLowerCase().replace(/\s+/g, '-')}-tab`}
                onClick={() => onSelectAsset(sym)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded transition-all whitespace-nowrap ${
                  isSelected
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 shadow-sm shadow-cyan-950 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="text-left">
                  <div className="flex items-center gap-1 font-mono text-[11px]">
                    <span>{sym}</span>
                    {meta?.isIndex && (
                      <span className="text-[8px] px-1 rounded bg-amber-500/20 text-amber-300 font-semibold">
                        INDEX
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px]">
                    <span className="text-slate-200 font-semibold">
                      ₹{price > 1000 ? price.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : safeFixed(price, 1)}
                    </span>
                    <span className={(chg || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {(chg || 0) >= 0 ? '+' : ''}{safeFixed(chg, 2)}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Account Capital & Balance Metrics (INR) */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 rounded-lg bg-slate-900/80 border border-slate-800 px-3 py-1.5">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">INTRADAY CAPITAL</div>
              <div className="font-mono font-bold text-xs text-slate-100">
                ₹{accountStats.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">EQUITY</div>
              <div className="font-mono font-bold text-xs text-cyan-300">
                ₹{accountStats.equity.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-800" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">REALIZED P&L</div>
              <div className={`font-mono font-bold text-xs flex items-center gap-0.5 ${accountStats.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {accountStats.realizedPnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {accountStats.realizedPnl >= 0 ? '+' : ''}₹{accountStats.realizedPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Quick Tool Actions */}
          <div className="flex items-center gap-1.5">
            <button
              id="toggle-sound-btn"
              onClick={() => {
                onToggleSound();
                soundFx.enabled = !soundEnabled;
              }}
              title={soundEnabled ? 'Mute Alert Audio' : 'Unmute Alert Audio'}
              className={`p-2 rounded-md border transition-colors ${
                soundEnabled
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            <button
              id="reset-account-btn"
              onClick={onResetAccount}
              title="Reset Capital to ₹10,00,000 (10 Lakhs)"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden md:inline text-[11px] font-mono font-medium">RESET ₹10L</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
