import React from 'react';
import { AssetSymbol, INSTRUMENT_METAS } from '../types/trading';
import { Layers, Activity, TrendingUp, TrendingDown, Target, Zap, Flame, ShieldAlert, BarChart3 } from 'lucide-react';

interface OptionChainViewerProps {
  selectedAsset: AssetSymbol;
  currentPrice: number;
}

const safeFixed = (val: number | undefined | null, digits: number = 2, fallback: string = '0.00'): string => {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return val.toFixed(digits);
};

export const OptionChainViewer: React.FC<OptionChainViewerProps> = ({
  selectedAsset,
  currentPrice,
}) => {
  const isBtc = selectedAsset === 'BTC/USD';
  const step = isBtc ? 1000 : 20;
  const atm = Math.round(currentPrice / step) * step;

  // Generate institutional strikes around ATM
  const strikes = [];
  const range = isBtc ? 5 : 4;
  for (let i = -range; i <= range; i++) {
    const strike = atm + i * step;
    const isAtm = strike === atm;
    const isItmCall = strike < currentPrice;
    const isItmPut = strike > currentPrice;

    // Realistic Deribit / CME style Open Interest & Implied Volatility
    const callOi = Math.round((Math.sin(i * 0.8 + 1.2) * 450 + 650) * (isBtc ? 1.5 : 8));
    const putOi = Math.round((Math.cos(i * 0.7 + 1.4) * 420 + 600) * (isBtc ? 1.4 : 7.5));
    const callIv = (isBtc ? 52.4 : 16.8) + Math.abs(i) * 0.8;
    const putIv = (isBtc ? 54.1 : 17.2) + Math.abs(i) * 0.9;
    const callPrice = Math.max(isBtc ? 50 : 2, isItmCall ? currentPrice - strike + 240 : (isBtc ? 420 : 12) / (Math.abs(i) + 1));
    const putPrice = Math.max(isBtc ? 50 : 2, isItmPut ? strike - currentPrice + 240 : (isBtc ? 420 : 12) / (Math.abs(i) + 1));

    strikes.push({
      strike,
      isAtm,
      callOi,
      putOi,
      callIv: Number(callIv.toFixed(1)),
      putIv: Number(putIv.toFixed(1)),
      callPrice: Number(callPrice.toFixed(isBtc ? 0 : 2)),
      putPrice: Number(putPrice.toFixed(isBtc ? 0 : 2)),
    });
  }

  const totalCallOi = strikes.reduce((acc, s) => acc + s.callOi, 0);
  const totalPutOi = strikes.reduce((acc, s) => acc + s.putOi, 0);
  const pcr = totalCallOi > 0 ? Number((totalPutOi / totalCallOi).toFixed(2)) : 0.95;
  const maxPain = atm - (isBtc ? 1000 : 10);

  return (
    <div className="flex flex-col bg-[#0b0e14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-[#0d121c]">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-purple-500/10 border border-purple-500/30 text-purple-400">
            <Layers className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <span>DERIVATIVES LIQUIDATIONS & OPTIONS GAMMA SURFACE</span>
              <span className="text-[10px] text-purple-400 font-semibold">[{selectedAsset}]</span>
            </h3>
            <div className="text-[10px] text-slate-400 font-mono">
              Deribit & CME Institutional Open Interest • Funding APR • Gamma Exposure (GEX)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-slate-500">MAX PAIN:</span>
          <span className="text-amber-400 font-bold">${maxPain.toLocaleString()}</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-500">PCR:</span>
          <span className="text-cyan-300 font-bold">{pcr}</span>
        </div>
      </div>

      {/* Derivatives Top HUD */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 border-b border-slate-800 bg-[#090d14] font-mono text-xs">
        <div className="p-2 rounded bg-[#0e1420] border border-slate-800">
          <div className="text-[9px] text-slate-500 uppercase font-semibold">8H FUNDING RATE (APR)</div>
          <div className="text-sm font-bold text-emerald-400 mt-0.5">
            +0.0084% <span className="text-xs text-slate-300 font-normal">(9.2% APR)</span>
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">Mild Long Bias / Healthy Leverage</div>
        </div>

        <div className="p-2 rounded bg-[#0e1420] border border-slate-800">
          <div className="text-[9px] text-slate-500 uppercase font-semibold">TOTAL OPEN INTEREST</div>
          <div className="text-sm font-bold text-slate-100 mt-0.5">
            {isBtc ? '$34.82B USD' : '$9.45B USD'}
          </div>
          <div className="text-[9px] text-cyan-400 mt-0.5">+4.2% Inflow (Institutional Buildup)</div>
        </div>

        <div className="p-2 rounded bg-[#0e1420] border border-rose-950/60">
          <div className="text-[9px] text-rose-400 uppercase font-semibold flex items-center gap-1">
            <Flame className="h-2.5 w-2.5" />
            <span>1H SHORT LIQUIDATIONS</span>
          </div>
          <div className="text-sm font-bold text-rose-300 mt-0.5">
            {isBtc ? '$18.60M USD' : '$4.20M USD'}
          </div>
          <div className="text-[9px] text-rose-500/80 mt-0.5">Short Squeeze Fuel Active</div>
        </div>

        <div className="p-2 rounded bg-[#0e1420] border border-slate-800">
          <div className="text-[9px] text-slate-500 uppercase font-semibold">GAMMA EXPOSURE REGIME</div>
          <div className="text-sm font-bold text-purple-400 mt-0.5">
            POSITIVE GAMMA (+GEX)
          </div>
          <div className="text-[9px] text-slate-400 mt-0.5">Market Maker Mean-Reversion Cushion</div>
        </div>
      </div>

      {/* Options Chain & OI Table */}
      <div className="p-3 overflow-x-auto">
        <table className="w-full text-center font-mono text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-[10px] text-slate-500">
              <th className="pb-2 text-left text-emerald-400">CALL OI</th>
              <th className="pb-2 text-emerald-400">CALL IV</th>
              <th className="pb-2 text-emerald-400">CALL LTP</th>
              <th className="pb-2 text-slate-200 font-bold bg-slate-900/60">STRIKE PRICE</th>
              <th className="pb-2 text-rose-400">PUT LTP</th>
              <th className="pb-2 text-rose-400">PUT IV</th>
              <th className="pb-2 text-right text-rose-400">PUT OI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {strikes.map((row) => (
              <tr
                key={row.strike}
                className={`hover:bg-slate-900/40 transition-colors ${
                  row.isAtm ? 'bg-amber-500/10 font-bold' : ''
                }`}
              >
                <td className="py-2 text-left text-emerald-400 font-semibold">
                  {row.callOi.toLocaleString()}
                </td>
                <td className="py-2 text-slate-400">{row.callIv}%</td>
                <td className="py-2 text-slate-300 font-bold">${row.callPrice}</td>

                <td
                  className={`py-2 font-extrabold ${
                    row.isAtm ? 'text-amber-400 bg-amber-500/20' : 'text-slate-100 bg-slate-900/30'
                  }`}
                >
                  ${row.strike.toLocaleString()}
                  {row.isAtm && <span className="ml-1 text-[9px] text-amber-300 font-bold">ATM</span>}
                </td>

                <td className="py-2 text-slate-300 font-bold">${row.putPrice}</td>
                <td className="py-2 text-slate-400">{row.putIv}%</td>
                <td className="py-2 text-right text-rose-400 font-semibold">
                  {row.putOi.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
