import React, { useState } from 'react';
import { AssetSymbol, OrderBookLevel, TapeTrade, INSTRUMENT_METAS } from '../types/trading';
import { Layers, Activity, Zap, Shield, Flame } from 'lucide-react';

interface OrderBookAndTapeProps {
  symbol: AssetSymbol;
  currentPrice?: number;
  bids?: OrderBookLevel[];
  asks?: OrderBookLevel[];
  spread?: number;
  trades?: TapeTrade[];
}

const safeFixed = (val: number | undefined | null, digits: number = 2, fallback: string = '0.00'): string => {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return val.toFixed(digits);
};

export const OrderBookAndTape: React.FC<OrderBookAndTapeProps> = ({
  symbol,
  currentPrice = 0,
  bids = [],
  asks = [],
  spread = 0.05,
  trades = [],
}) => {
  const [activeTab, setActiveTab] = useState<'DOM' | 'TAPE'>('DOM');
  const meta = INSTRUMENT_METAS[symbol] || INSTRUMENT_METAS['NIFTY 50'];

  return (
    <div className="flex flex-col h-full bg-[#0b0e14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Header with Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 bg-[#0d121c]">
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          <button
            onClick={() => setActiveTab('DOM')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
              activeTab === 'DOM' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ORDER BOOK (DOM)
          </button>
          <button
            onClick={() => setActiveTab('TAPE')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
              activeTab === 'TAPE' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            LIVE TAPE
          </button>
        </div>

        {/* Live Spread Pill */}
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400">
          <span>SPREAD:</span>
          {(!bids || bids.length === 0) && (!asks || asks.length === 0) ? (
            <span className="text-amber-400/90 font-bold">DATA UNAVAILABLE</span>
          ) : (
            <span className="text-cyan-300 font-bold">
              ₹{safeFixed(spread, 2)} ({meta.tickSize} tick)
            </span>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden p-2">
        {activeTab === 'DOM' ? (
          (!bids || bids.length === 0) && (!asks || asks.length === 0) ? (
            <div className="flex h-full flex-col items-center justify-center p-4 text-center font-mono select-none">
              <div className="rounded bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[11px] font-bold text-amber-400 mb-2">
                DATA UNAVAILABLE
              </div>
              <p className="text-[11px] text-slate-300 max-w-xs leading-relaxed">
                {meta.isIndex
                  ? `Spot Index (${symbol}) is a cash calculation benchmark and does not maintain an exchange Order Book (DOM).`
                  : `Live 5-level market depth for ${symbol} is unavailable from Upstox.`}
              </p>
              <p className="text-[10px] text-slate-500 mt-1.5 max-w-xs">
                {meta.isIndex
                  ? 'Select an equity stock (e.g. RELIANCE, TCS) with an active Upstox feed for real market depth.'
                  : 'An active Upstox Pro v2 token during exchange trading hours is required. Synthetic depth is strictly disabled.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full font-mono text-[11px]">
              {/* Table Header */}
              <div className="grid grid-cols-3 text-[10px] text-slate-500 border-b border-slate-800/80 pb-1 mb-1 px-1">
                <span>PRICE (₹)</span>
                <span className="text-right">QTY ({meta.lotSize ? `${meta.lotSize}x` : 'QTY'})</span>
                <span className="text-right">ORDERS</span>
              </div>

              {/* Asks (Sellers - Red) */}
              <div className="flex-1 flex flex-col justify-end space-y-0.5 overflow-hidden">
                {asks.slice(-6).map((ask, i) => (
                  <div key={i} className="relative grid grid-cols-3 px-1 py-0.5 text-rose-300 items-center">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none rounded"
                      style={{ width: `${ask.percent || 0}%` }}
                    />
                    <span className="relative z-10 font-medium">₹{safeFixed(ask.price, 2)}</span>
                    <span className="relative z-10 text-right text-slate-300">{(ask.amount || 0).toLocaleString('en-IN')}</span>
                    <span className="relative z-10 text-right text-slate-400">{ask.ordersCount || 5}</span>
                  </div>
                ))}
              </div>

              {/* Mid Price Separator Bar */}
              <div className="my-1.5 py-1 px-2 bg-[#090d14] border-y border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="font-bold text-xs text-slate-100">₹{safeFixed(currentPrice, 2)}</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono">NSE DMA TICK FEED</span>
              </div>

              {/* Bids (Buyers - Green) */}
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {bids.slice(0, 6).map((bid, i) => (
                  <div key={i} className="relative grid grid-cols-3 px-1 py-0.5 text-emerald-300 items-center">
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none rounded"
                      style={{ width: `${bid.percent || 0}%` }}
                    />
                    <span className="relative z-10 font-medium">₹{safeFixed(bid.price, 2)}</span>
                    <span className="relative z-10 text-right text-slate-300">{(bid.amount || 0).toLocaleString('en-IN')}</span>
                    <span className="relative z-10 text-right text-slate-400">{bid.ordersCount || 5}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          /* Live Time & Sales Tape */
          <div className="flex flex-col h-full font-mono text-[11px]">
            <div className="grid grid-cols-4 text-[10px] text-slate-500 border-b border-slate-800/80 pb-1 mb-1 px-1">
              <span>TIME</span>
              <span className="text-right">PRICE (₹)</span>
              <span className="text-right">QTY</span>
              <span className="text-right">TYPE</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
              {trades.map((t) => (
                <div
                  key={t.id}
                  className={`grid grid-cols-4 px-1 py-0.5 rounded items-center ${
                    t.isBlockTrade ? 'bg-amber-500/10 border border-amber-500/30' : ''
                  }`}
                >
                  <span className="text-slate-500 text-[10px]">{t.time}</span>
                  <span className={`text-right font-bold ${t.side.toUpperCase() === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ₹{safeFixed(t.price, 1)}
                  </span>
                  <span className="text-right text-slate-200">
                    {t.amount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-right text-[10px]">
                    {t.isBlockTrade ? (
                      <span className="px-1 rounded bg-amber-500/20 text-amber-300 font-bold">
                        BLOCK
                      </span>
                    ) : (
                      <span className={t.side.toUpperCase() === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                        {t.side.toUpperCase() === 'BUY' ? 'LIFT' : 'HIT'}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
