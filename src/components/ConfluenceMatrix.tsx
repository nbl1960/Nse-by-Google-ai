import React from 'react';
import { AssetSymbol, ConfluenceFactor, MacroIntermarketData, KillzoneInfo } from '../types/trading';
import { 
  Gauge, 
  Layers, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Clock, 
  Compass, 
  Activity, 
  BarChart3, 
  ShieldCheck,
  Flame,
  Globe,
  Radio,
  SlidersHorizontal,
  DollarSign
} from 'lucide-react';

interface ConfluenceMatrixProps {
  symbol: AssetSymbol;
  currentPrice: number;
  macroData: MacroIntermarketData | null;
  confluenceScore: number;
  factors?: ConfluenceFactor[];
  killzoneInfo?: KillzoneInfo;
}

const safeFixed = (val: number | undefined | null, digits: number = 2, fallback: string = '0.00'): string => {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return val.toFixed(digits);
};

export const ConfluenceMatrix: React.FC<ConfluenceMatrixProps> = ({
  symbol,
  currentPrice,
  macroData,
  confluenceScore,
  factors = [],
  killzoneInfo,
}) => {
  const isBullishBias = confluenceScore >= 60;
  const isBearishBias = confluenceScore <= 40;

  // Group factors by category
  const smcFactors = factors.filter((f) => f.category === 'SMC');
  const orderFlowFactors = factors.filter((f) => f.category === 'ORDER_FLOW');
  const macroFactors = factors.filter((f) => f.category === 'MACRO_INTERMARKET');
  const technicalFactors = factors.filter((f) => f.category === 'TECHNICAL');

  return (
    <div className="flex flex-col h-full bg-[#0b0e14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5 bg-[#0d121c]">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-amber-400" />
          <span className="font-mono font-bold text-xs uppercase tracking-wider text-slate-200">
            INSTITUTIONAL CONFLUENCE MATRIX
          </span>
          <span className="text-[10px] text-amber-400 font-mono font-semibold">
            [{symbol}]
          </span>
        </div>

        {/* Global Confluence Score Pill */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">CONFLUENCE:</span>
          <div
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded font-mono font-extrabold text-xs border ${
              isBullishBias
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : isBearishBias
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <span>{confluenceScore}%</span>
            <span className="text-[10px] uppercase font-semibold">
              {isBullishBias ? 'BULLISH CONVICTION' : isBearishBias ? 'BEARISH CONVICTION' : 'EQUILIBRIUM CHOP'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Parameters Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* Confluence Meter Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-md p-3">
          <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
            <span className="text-slate-400">INSTITUTIONAL EDGE ALIGNMENT FOR {symbol}</span>
            <span className="text-amber-400 font-bold">{confluenceScore}/100</span>
          </div>
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
            <div
              className={`h-full transition-all duration-500 ${
                isBullishBias
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-400'
                  : isBearishBias
                  ? 'bg-gradient-to-r from-rose-600 to-rose-400'
                  : 'bg-gradient-to-r from-amber-600 to-amber-400'
              }`}
              style={{ width: `${confluenceScore}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-slate-500 font-mono mt-1">
            <span>BEARISH SUPPLY DOMINANCE (0%)</span>
            <span>EQUILIBRIUM / RANGE (50%)</span>
            <span>INSTITUTIONAL ACCUMULATION (100%)</span>
          </div>
        </div>

        {/* 1. Smart Money Concepts (SMC) Section */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300 mb-2">
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            <span>1. SMART MONEY CONCEPTS & MARKET STRUCTURE</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
            {smcFactors.map((f, i) => (
              <div
                key={i}
                className="p-2.5 rounded bg-[#0e1420] border border-slate-800 flex items-start justify-between gap-2"
              >
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">{f.name}</div>
                  <div className="text-slate-200 font-semibold text-xs mt-0.5">{f.value}</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">{f.detail}</div>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold shrink-0 ${
                    f.status === 'BULLISH'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : f.status === 'BEARISH'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {f.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Order Flow & Institutional Microstructure */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300 mb-2">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>2. ORDER FLOW, VOLUME PROFILE & LIQUIDITY</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
            {orderFlowFactors.map((f, i) => (
              <div
                key={i}
                className="p-2.5 rounded bg-[#0e1420] border border-slate-800 flex items-start justify-between gap-2"
              >
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">{f.name}</div>
                  <div className="text-slate-200 font-semibold text-xs mt-0.5">{f.value}</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">{f.detail}</div>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold shrink-0 ${
                    f.status === 'BULLISH'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : f.status === 'BEARISH'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {f.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Intermarket Macro & Derivatives */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300 mb-2">
            <Globe className="h-3.5 w-3.5 text-amber-400" />
            <span>3. INTERMARKET MACRO & DERIVATIVES FLOW</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-xs">
            {macroFactors.map((f, i) => (
              <div
                key={i}
                className="p-2.5 rounded bg-[#0e1420] border border-slate-800 flex items-start justify-between gap-2"
              >
                <div>
                  <div className="text-[10px] text-slate-400 font-bold uppercase">{f.name}</div>
                  <div className="text-slate-200 font-semibold text-xs mt-0.5">{f.value}</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">{f.detail}</div>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold shrink-0 ${
                    f.status === 'BULLISH'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : f.status === 'BEARISH'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {f.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Killzone & Intraday Session State */}
        {killzoneInfo && (
          <div className="p-3 rounded bg-[#090d14] border border-slate-800/80 font-mono text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-amber-400" />
                <span>ACTIVE SESSION: {killzoneInfo.label}</span>
              </span>
              <span className="text-amber-400 font-extrabold text-[11px]">{killzoneInfo.timeRemaining}</span>
            </div>
            <div className="text-slate-300 text-xs">
              Manipulation Profile: <b className="text-cyan-400">{killzoneInfo.manipulationState}</b>. {killzoneInfo.description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
