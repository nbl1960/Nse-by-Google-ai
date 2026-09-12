import React from 'react';
import { AssetSymbol, PrimaryTradeSymbol, AccountStats, BrokerConnection, INSTRUMENT_METAS, KillzoneInfo } from '../types/trading';
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
  Flame,
  Globe,
  Radio,
  SlidersHorizontal,
  DollarSign
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface HeaderProps {
  selectedAsset: PrimaryTradeSymbol;
  onSelectAsset: (asset: PrimaryTradeSymbol) => void;
  assetPrices: Record<AssetSymbol, number>;
  assetChanges: Record<AssetSymbol, number>;
  accountStats: AccountStats;
  onResetAccount: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  killzoneInfo: KillzoneInfo;
  brokerConfig: BrokerConnection;
  onOpenBrokerModal: () => void;
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
  accountStats,
  onResetAccount,
  soundEnabled,
  onToggleSound,
  killzoneInfo,
  brokerConfig,
  onOpenBrokerModal,
}) => {
  const primaryAssets: PrimaryTradeSymbol[] = ['BTC/USD', 'XAU/USD'];

  const currentPrice = assetPrices[selectedAsset] || INSTRUMENT_METAS[selectedAsset].basePrice;
  const currentChange = assetChanges[selectedAsset] || 0;
  const isPos = currentChange >= 0;

  // Macro metrics
  const dxyPrice = assetPrices['DXY'] || 101.45;
  const dxyChange = assetChanges['DXY'] || -0.32;
  const us10yPrice = assetPrices['US10Y'] || 3.72;

  return (
    <header className="border-b border-slate-800/90 bg-[#080b11] px-4 py-2.5 text-xs select-none sticky top-0 z-40">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Market Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black tracking-tighter shadow-sm shadow-amber-950">
              <Zap className="h-4 w-4 fill-amber-400 text-amber-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-extrabold text-sm tracking-wider text-slate-100 uppercase">
                  APEX <span className="text-amber-400">//</span> INSTITUTIONAL
                </span>
                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  DMA SUB-MS FEED
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                <span className="text-slate-300 font-semibold">BTC & XAU/USD</span>
                <span>•</span>
                <span className="text-cyan-400 font-medium">SMC / ORDER FLOW / LIQUIDITY</span>
              </div>
            </div>
          </div>

          {/* Primary Asset Selector Switch */}
          <div className="flex items-center gap-1 rounded-lg bg-[#0f141e] border border-slate-800 p-1">
            {primaryAssets.map((sym) => {
              const isActive = selectedAsset === sym;
              const p = assetPrices[sym] || INSTRUMENT_METAS[sym].basePrice;
              const c = assetChanges[sym] || 0;
              const positive = c >= 0;

              return (
                <button
                  key={sym}
                  id={`asset-tab-${sym.replace('/', '-')}`}
                  onClick={() => {
                    onSelectAsset(sym);
                    soundFx.playClick();
                  }}
                  className={`flex items-center gap-2 rounded-md px-3 py-1.5 font-mono text-xs transition-all ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                      : 'text-slate-300 hover:text-slate-100 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="font-bold">{sym}</span>
                  <span className={`text-[11px] ${isActive ? 'text-slate-900 font-extrabold' : 'text-slate-400'}`}>
                    ${sym === 'BTC/USD' ? safeFixed(p, 1) : safeFixed(p, 2)}
                  </span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                      isActive
                        ? 'bg-slate-900/20 text-slate-950'
                        : positive
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-rose-400 bg-rose-500/10'
                    }`}
                  >
                    {positive ? '+' : ''}{safeFixed(c, 2)}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: ICT Killzone & Session Timing */}
        <div className="hidden lg:flex items-center gap-2 rounded-lg bg-[#0c1018] border border-slate-800/80 px-3 py-1.5">
          <Clock className="h-3.5 w-3.5 text-amber-400 animate-spin-slow" />
          <div>
            <div className="flex items-center gap-2 text-[10px] font-mono">
              <span className="font-bold text-amber-400 uppercase tracking-wide">
                {killzoneInfo.label}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-300 font-semibold">{killzoneInfo.timeRemaining}</span>
            </div>
            <div className="text-[9px] text-slate-400 flex items-center gap-1.5">
              <span className="px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-medium">
                STATE: {killzoneInfo.manipulationState}
              </span>
              <span>{killzoneInfo.description}</span>
            </div>
          </div>
        </div>

        {/* Right: Macro Indicators & Account Desk */}
        <div className="flex items-center gap-3">
          {/* Macro Correlates Pills (DXY & US10Y) */}
          <div className="hidden xl:flex items-center gap-2 font-mono text-[11px]">
            <div className="flex items-center gap-1.5 rounded-md bg-[#0e131d] border border-slate-800 px-2.5 py-1">
              <span className="text-slate-400 font-semibold">DXY:</span>
              <span className="text-slate-200 font-bold">{safeFixed(dxyPrice, 2)}</span>
              <span className={`text-[10px] ${dxyChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {dxyChange >= 0 ? '+' : ''}{safeFixed(dxyChange, 2)}%
              </span>
              <span className="text-[9px] text-amber-400/80 bg-amber-500/10 px-1 rounded">
                -0.88 INV
              </span>
            </div>

            <div className="flex items-center gap-1.5 rounded-md bg-[#0e131d] border border-slate-800 px-2.5 py-1">
              <span className="text-slate-400 font-semibold">US10Y:</span>
              <span className="text-slate-200 font-bold">{safeFixed(us10yPrice, 3)}%</span>
              <span className="text-[9px] text-cyan-400 bg-cyan-500/10 px-1 rounded">
                REAL YIELDS
              </span>
            </div>
          </div>

          {/* Broker Live Status Button */}
          <button
            id="broker-connect-btn"
            onClick={onOpenBrokerModal}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-mono font-medium border transition-colors ${
              brokerConfig.mode === 'LIVE'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            <Radio className={`h-3 w-3 ${brokerConfig.mode === 'LIVE' ? 'animate-pulse text-emerald-400' : 'text-amber-400'}`} />
            <span>{brokerConfig.mode === 'LIVE' ? 'LIVE BROKER' : 'PRO SIMULATION'}</span>
            <span className="text-[9px] text-slate-400">({brokerConfig.latencyMs}ms)</span>
          </button>

          {/* Account Balance & Equity */}
          <div className="flex items-center gap-2 rounded-lg bg-[#0e131d] border border-slate-800 px-3 py-1 font-mono">
            <div>
              <div className="text-[9px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                <span>ACCOUNT EQUITY</span>
              </div>
              <div className="text-xs font-bold text-slate-100">
                ${safeFixed(accountStats.equity, 2, '100,000.00')}
              </div>
            </div>
            <div className="border-l border-slate-800 pl-2">
              <div className="text-[9px] text-slate-400 uppercase font-semibold">FREE MARGIN</div>
              <div className="text-xs font-bold text-emerald-400">
                ${safeFixed(accountStats.freeMargin, 2, '87,500.00')}
              </div>
            </div>
          </div>

          {/* Reset Account & Audio Toggles */}
          <div className="flex items-center gap-1">
            <button
              id="reset-account-btn"
              onClick={() => {
                if (window.confirm('Reset simulated account balance to initial $100,000 USD?')) {
                  onResetAccount();
                  soundFx.playClick();
                }
              }}
              title="Reset Simulated Account Balance ($100,000)"
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              id="toggle-sound-btn"
              onClick={onToggleSound}
              title={soundEnabled ? 'Disable Audio Signals' : 'Enable Audio Signals'}
              className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-amber-400" /> : <VolumeX className="h-3.5 w-3.5 text-slate-500" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
