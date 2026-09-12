import React from 'react';
import { AssetSymbol, ConfluenceFactor, MacroData } from '../types/trading';
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
  ShieldCheck
} from 'lucide-react';

interface ConfluenceMatrixProps {
  symbol: AssetSymbol;
  currentPrice: number;
  macroData: MacroData | null;
  confluenceScore: number;
  factors?: ConfluenceFactor[];
  onFactorClick?: (factor: ConfluenceFactor) => void;
}

export const ConfluenceMatrix: React.FC<ConfluenceMatrixProps> = ({
  symbol,
  currentPrice,
  macroData,
  confluenceScore,
  factors = [],
}) => {
  const isBullishBias = confluenceScore >= 60;
  const isBearishBias = confluenceScore <= 40;

  // Group factors by category safely
  const safeFactors = factors || [];
  const smcFactors = safeFactors.filter((f) => f.category === 'SMC');
  const orderFlowFactors = safeFactors.filter((f) => f.category === 'ORDER_FLOW');
  const indicatorFactors = safeFactors.filter((f) => f.category === 'INDICATORS');

  return (
    <div className="flex flex-col h-full bg-[#0b0e14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5 bg-[#0d121c]">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-cyan-400" />
          <span className="font-mono font-bold text-xs uppercase tracking-wider text-slate-200">
            INSTITUTIONAL CONFLUENCE ENGINE (INDIA F&O)
          </span>
        </div>

        {/* Global Confluence Score Pill */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-400 font-mono">CONFLUENCE:</span>
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded font-mono font-extrabold text-xs border ${
              isBullishBias
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : isBearishBias
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            }`}
          >
            <span>{confluenceScore}%</span>
            <span className="text-[10px] uppercase font-semibold">
              {isBullishBias ? 'BULLISH CONVICTION' : isBearishBias ? 'BEARISH CONVICTION' : 'BALANCED CPR CHOP'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Parameters Scrollable Grid */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {/* Confluence Meter Bar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-md p-3">
          <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
            <span className="text-slate-400">INSTITUTIONAL EDGE ALIGNMENT FOR {symbol}</span>
            <span className="text-cyan-300 font-bold">{confluenceScore}/100</span>
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
            <span>BEARISH DEFICIT (0%)</span>
            <span>CPR EQUILIBRIUM (50%)</span>
            <span>INSTITUTIONAL ACCUMULATION (100%)</span>
          </div>
        </div>

        {/* 1. Smart Money Concepts (SMC) & Central Pivot Range (CPR) */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300 mb-2">
            <Layers className="h-3.5 w-3.5 text-cyan-400" />
            <span>1. SMART MONEY CONCEPTS & CPR GEOMETRY</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {smcFactors.map((f) => (
              <div
                key={f.id}
                className="bg-[#0f1420] border border-slate-800/80 rounded p-2.5 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-semibold text-slate-200">{f.name}</span>
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      f.status === 'BULLISH'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : f.status === 'BEARISH'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {f.status}
                  </span>
                </div>
                <div className="text-[11px] text-cyan-300/90 font-mono">{f.detail}</div>
                <div className="text-[10px] text-slate-400 mt-1 leading-snug">{f.institutionalSignificance}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Order Flow & Derivatives Positioning */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-amber-400" />
            <span>2. ORDER FLOW & OPTION CHAIN OI POSITIONING</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {orderFlowFactors.map((f) => (
              <div
                key={f.id}
                className="bg-[#0f1420] border border-slate-800/80 rounded p-2.5 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-semibold text-slate-200">{f.name}</span>
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      f.status === 'BULLISH'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : f.status === 'BEARISH'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {f.status}
                  </span>
                </div>
                <div className="text-[11px] text-amber-300/90 font-mono">{f.detail}</div>
                <div className="text-[10px] text-slate-400 mt-1 leading-snug">{f.institutionalSignificance}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Indian Macro Drivers & Intermarket Liquidity */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300 mb-2">
            <Compass className="h-3.5 w-3.5 text-blue-400" />
            <span>3. INDIAN MACRO DRIVERS & INSTITUTIONAL FLOWS</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-[#0f1420] border border-slate-800 rounded p-2 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-mono">INDIA VIX</div>
              <div className="font-mono text-xs font-bold text-slate-100">
                {macroData?.indiaVix?.value || 13.84}
              </div>
              <div className="text-[10px] text-emerald-400 font-mono">
                {macroData?.indiaVix?.trend || 'Low Vol / Bull Trend'}
              </div>
            </div>

            <div className="bg-[#0f1420] border border-slate-800 rounded p-2 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-mono">FII NET FLOW</div>
              <div className="font-mono text-xs font-bold text-emerald-300">
                +{macroData?.fiiDii?.fiiNetCr || 412.0} Cr
              </div>
              <div className="text-[10px] text-slate-400 font-mono">Net Cash Inflow</div>
            </div>

            <div className="bg-[#0f1420] border border-slate-800 rounded p-2 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-mono">DII NET FLOW</div>
              <div className="font-mono text-xs font-bold text-emerald-300">
                +{macroData?.fiiDii?.diiNetCr || 527.7} Cr
              </div>
              <div className="text-[10px] text-slate-400 font-mono">Domestic Support</div>
            </div>

            <div className="bg-[#0f1420] border border-slate-800 rounded p-2 text-center">
              <div className="text-[10px] text-slate-500 uppercase font-mono">USD / INR</div>
              <div className="font-mono text-xs font-bold text-slate-100">
                ₹{macroData?.usdInr?.value || 86.24}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {macroData?.usdInr?.trend || 'Stable Range'}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Multi-Timeframe Momentum & Volatility */}
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300 mb-2">
            <Activity className="h-3.5 w-3.5 text-purple-400" />
            <span>4. MULTI-TIMEFRAME RSI & VOLATILITY EXHAUSTION</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {indicatorFactors.map((f) => (
              <div
                key={f.id}
                className="bg-[#0f1420] border border-slate-800/80 rounded p-2.5 hover:border-slate-700 transition-all"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-semibold text-slate-200">{f.name}</span>
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      f.status === 'BULLISH'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : f.status === 'BEARISH'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {f.status}
                  </span>
                </div>
                <div className="text-[11px] text-purple-300/90 font-mono">{f.detail}</div>
                <div className="text-[10px] text-slate-400 mt-1 leading-snug">{f.institutionalSignificance}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
