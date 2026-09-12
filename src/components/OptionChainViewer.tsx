import React from 'react';
import { OptionChainData, OptionChainStrike, AssetSymbol } from '../types/trading';
import { Layers, Activity, TrendingUp, TrendingDown, Target, Zap } from 'lucide-react';

interface OptionChainViewerProps {
  data: OptionChainData | null;
  selectedAsset: AssetSymbol;
  currentPrice: number;
  onSelectOptionTrade: (strike: number, type: 'CE' | 'PE', ltp: number) => void;
}

export const OptionChainViewer: React.FC<OptionChainViewerProps> = ({
  data,
  selectedAsset,
  currentPrice,
  onSelectOptionTrade,
}) => {
  if (!data || !data.strikes || data.strikes.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl border border-slate-800 bg-[#0c1017] p-8 text-center text-slate-400 font-mono text-xs">
        <div className="flex flex-col items-center gap-2">
          <Activity className="h-6 w-6 animate-spin text-cyan-400" />
          <span>Calibrating Live Option Chain & PCR Matrix for {selectedAsset}...</span>
        </div>
      </div>
    );
  }

  // Calculate max OI for visual proportion bars
  const maxCeOi = Math.max(...data.strikes.map((s) => s.ceOi), 1);
  const maxPeOi = Math.max(...data.strikes.map((s) => s.peOi), 1);

  return (
    <div className="rounded-xl border border-slate-800/80 bg-[#0c1017] p-4 text-xs select-none">
      {/* Top Derivatives Metrics HUD */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        {/* PCR Meter */}
        <div className="rounded-lg border border-slate-800 bg-[#080b11] p-3">
          <div className="text-[10px] text-slate-400 font-medium uppercase">PUT-CALL RATIO (PCR)</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-mono text-lg font-bold text-slate-100">{data.pcr}</span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              data.sentiment.includes('BULLISH')
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : data.sentiment.includes('BEARISH')
                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                : 'bg-slate-800 text-slate-300'
            }`}>
              {data.sentiment.replace('_', ' ')}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {data.pcr > 1.2 ? 'Heavy Put Writing (Strong Floor)' : data.pcr < 0.8 ? 'Heavy Call Writing (Strong Ceiling)' : 'Balanced Gamma Exposure'}
          </div>
        </div>

        {/* Max Pain Strike */}
        <div className="rounded-lg border border-slate-800 bg-[#080b11] p-3">
          <div className="text-[10px] text-slate-400 font-medium uppercase flex items-center gap-1">
            <Target className="h-3 w-3 text-amber-400" />
            MAX PAIN STRIKE
          </div>
          <div className="font-mono text-lg font-bold text-amber-300 mt-1">
            ₹{data.maxPain.toLocaleString('en-IN')}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Institutional expiration gravitational pull
          </div>
        </div>

        {/* ATM Straddle Premium */}
        <div className="rounded-lg border border-slate-800 bg-[#080b11] p-3">
          <div className="text-[10px] text-slate-400 font-medium uppercase">ATM STRADDLE PREMIUM</div>
          <div className="font-mono text-lg font-bold text-cyan-300 mt-1">
            ₹{data.atmStraddle}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Expected intraday move: ±{(data.atmStraddle).toFixed(0)} pts
          </div>
        </div>

        {/* Total Call OI vs Put OI */}
        <div className="rounded-lg border border-slate-800 bg-[#080b11] p-3 col-span-2 md:col-span-2">
          <div className="text-[10px] text-slate-400 font-medium uppercase flex items-center justify-between">
            <span>TOTAL OPEN INTEREST SKEW</span>
            <span className="font-mono text-slate-300">EXPIRY: {data.expiry}</span>
          </div>
          <div className="flex items-center justify-between font-mono text-xs font-semibold mt-1">
            <span className="text-rose-400">CALL OI: {(data.totalCeOi / 100000).toFixed(2)}L</span>
            <span className="text-emerald-400">PUT OI: {(data.totalPeOi / 100000).toFixed(2)}L</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden flex mt-1.5">
            <div
              className="bg-rose-500 h-full transition-all"
              style={{ width: `${(data.totalCeOi / (data.totalCeOi + data.totalPeOi)) * 100}%` }}
              title="Call OI (Resistance)"
            />
            <div
              className="bg-emerald-500 h-full transition-all"
              style={{ width: `${(data.totalPeOi / (data.totalCeOi + data.totalPeOi)) * 100}%` }}
              title="Put OI (Support)"
            />
          </div>
        </div>
      </div>

      {/* Option Chain Table */}
      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#080b11]">
        <table className="w-full text-left font-mono text-[11px] border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400 bg-slate-900/60">
              <th colSpan={4} className="py-2 px-3 text-center border-r border-slate-800 text-rose-300 bg-rose-950/20">
                CALLS (CE) - RESISTANCE
              </th>
              <th className="py-2 px-3 text-center text-cyan-300 bg-cyan-950/20 font-bold">
                STRIKE (₹)
              </th>
              <th colSpan={4} className="py-2 px-3 text-center border-l border-slate-800 text-emerald-300 bg-emerald-950/20">
                PUTS (PE) - SUPPORT
              </th>
            </tr>
            <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-500 bg-slate-900/40">
              <th className="py-1.5 px-2 text-right">OI (Chg)</th>
              <th className="py-1.5 px-2 text-right">IV</th>
              <th className="py-1.5 px-2 text-right">LTP (₹)</th>
              <th className="py-1.5 px-2 text-center border-r border-slate-800">TRADE CE</th>
              <th className="py-1.5 px-3 text-center text-slate-300 font-bold">LTP: ₹{currentPrice.toFixed(1)}</th>
              <th className="py-1.5 px-2 text-center border-l border-slate-800">TRADE PE</th>
              <th className="py-1.5 px-2 text-left">LTP (₹)</th>
              <th className="py-1.5 px-2 text-left">IV</th>
              <th className="py-1.5 px-2 text-left">OI (Chg)</th>
            </tr>
          </thead>
          <tbody>
            {data.strikes.map((row) => {
              const isMaxPain = row.strike === data.maxPain;
              const ceOiPct = Math.round((row.ceOi / maxCeOi) * 100);
              const peOiPct = Math.round((row.peOi / maxPeOi) * 100);

              return (
                <tr
                  key={row.strike}
                  className={`border-b border-slate-800/60 transition-colors ${
                    row.isAtm
                      ? 'bg-cyan-500/10 font-semibold'
                      : isMaxPain
                      ? 'bg-amber-500/5'
                      : 'hover:bg-slate-850/50'
                  }`}
                >
                  {/* CE OI & Visual Bar */}
                  <td className="py-1.5 px-2 text-right relative">
                    <div
                      className="absolute inset-y-1 right-0 bg-rose-500/10 rounded-l transition-all pointer-events-none"
                      style={{ width: `${ceOiPct}%` }}
                    />
                    <div className="relative z-10 text-slate-200">
                      {(row.ceOi / 1000).toFixed(0)}k
                      <span className={`ml-1 text-[9px] ${row.ceOiChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ({row.ceOiChange >= 0 ? '+' : ''}{(row.ceOiChange / 1000).toFixed(0)}k)
                      </span>
                    </div>
                  </td>

                  {/* CE IV */}
                  <td className="py-1.5 px-2 text-right text-slate-400">
                    {row.ceIv}%
                  </td>

                  {/* CE LTP */}
                  <td className="py-1.5 px-2 text-right font-bold text-slate-100">
                    ₹{row.ceLtp.toFixed(1)}
                  </td>

                  {/* Trade CE Button */}
                  <td className="py-1.5 px-2 text-center border-r border-slate-800">
                    <button
                      onClick={() => onSelectOptionTrade(row.strike, 'CE', row.ceLtp)}
                      className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-semibold"
                      title={`Select ${selectedAsset} ${row.strike} CE`}
                    >
                      BUY CE
                    </button>
                  </td>

                  {/* Strike Column */}
                  <td className="py-1.5 px-3 text-center font-bold text-slate-100 bg-slate-900/30">
                    <div className="flex items-center justify-center gap-1">
                      <span>{row.strike}</span>
                      {row.isAtm && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/30 text-cyan-200 border border-cyan-500/50">
                          ATM
                        </span>
                      )}
                      {isMaxPain && !row.isAtm && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/30 text-amber-200 border border-amber-500/50">
                          PAIN
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Trade PE Button */}
                  <td className="py-1.5 px-2 text-center border-l border-slate-800">
                    <button
                      onClick={() => onSelectOptionTrade(row.strike, 'PE', row.peLtp)}
                      className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500 hover:text-white transition-all text-[10px] font-semibold"
                      title={`Select ${selectedAsset} ${row.strike} PE`}
                    >
                      BUY PE
                    </button>
                  </td>

                  {/* PE LTP */}
                  <td className="py-1.5 px-2 text-left font-bold text-slate-100">
                    ₹{row.peLtp.toFixed(1)}
                  </td>

                  {/* PE IV */}
                  <td className="py-1.5 px-2 text-left text-slate-400">
                    {row.peIv}%
                  </td>

                  {/* PE OI & Visual Bar */}
                  <td className="py-1.5 px-2 text-left relative">
                    <div
                      className="absolute inset-y-1 left-0 bg-emerald-500/10 rounded-r transition-all pointer-events-none"
                      style={{ width: `${peOiPct}%` }}
                    />
                    <div className="relative z-10 text-slate-200">
                      {(row.peOi / 1000).toFixed(0)}k
                      <span className={`ml-1 text-[9px] ${row.peOiChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ({row.peOiChange >= 0 ? '+' : ''}{(row.peOiChange / 1000).toFixed(0)}k)
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
