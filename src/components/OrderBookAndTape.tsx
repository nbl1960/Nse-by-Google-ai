import React, { useState } from 'react';
import { AssetSymbol, OrderBookLevel, TapeTrade, INSTRUMENT_METAS } from '../types/trading';
import { Layers, Activity, Zap, Shield, Flame, AlertCircle } from 'lucide-react';

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
  spread = 0.50,
  trades = [],
}) => {
  const [activeTab, setActiveTab] = useState<'DOM' | 'TAPE'>('DOM');
  const meta = INSTRUMENT_METAS[symbol] || INSTRUMENT_METAS['BTC/USD'];

  // Calculate Order Book Imbalance
  const totalBidQty = bids.reduce((acc, b) => acc + b.amount, 0);
  const totalAskQty = asks.reduce((acc, a) => acc + a.amount, 0);
  const totalBookQty = totalBidQty + totalAskQty || 1;
  const bidRatio = Math.round((totalBidQty / totalBookQty) * 100);
  const askRatio = 100 - bidRatio;

  return (
    <div className="flex flex-col h-full bg-[#0b0e14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Header with Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 bg-[#0d121c]">
        <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
          <button
            id="tab-dom-btn"
            onClick={() => setActiveTab('DOM')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'DOM' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ORDER BOOK (DOM)
          </button>
          <button
            id="tab-tape-btn"
            onClick={() => setActiveTab('TAPE')}
            className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'TAPE' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            LIVE TAPE
          </button>
        </div>

        {/* Spread & Imbalance */}
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="text-slate-500">SPREAD:</span>
          <span className="text-cyan-300 font-bold">
            ${safeFixed(spread, 2)}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 font-bold">{bidRatio}% BID</span>
          <span className="text-slate-600">/</span>
          <span className="text-rose-400 font-bold">{askRatio}% ASK</span>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden p-2">
        {activeTab === 'DOM' ? (
          <div className="flex flex-col h-full font-mono text-[11px]">
            {/* Table Header */}
            <div className="grid grid-cols-3 text-[10px] text-slate-500 border-b border-slate-800/80 pb-1 mb-1 px-1">
              <span>PRICE ($)</span>
              <span className="text-right">SIZE ({symbol === 'BTC/USD' ? 'BTC' : 'OZ'})</span>
              <span className="text-right">TOTAL</span>
            </div>

            {/* Asks (Sellers - Red) */}
            <div className="flex-1 flex flex-col justify-end space-y-0.5 overflow-hidden">
              {asks.slice(-6).map((ask, i) => (
                <div key={i} className="relative grid grid-cols-3 px-1 py-0.5 text-rose-300 items-center">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-rose-500/10 pointer-events-none rounded"
                    style={{ width: `${ask.percent || 0}%` }}
                  />
                  <span className="font-bold relative z-10 flex items-center gap-1">
                    {safeFixed(ask.price, symbol === 'BTC/USD' ? 1 : 2)}
                    {ask.isIceberg && (
                      <span className="text-[8px] bg-rose-500/20 text-rose-400 px-1 py-0.2 rounded font-mono">
                        ICEBERG
                      </span>
                    )}
                  </span>
                  <span className="text-right text-slate-300 relative z-10">
                    {safeFixed(ask.amount, symbol === 'BTC/USD' ? 3 : 1)}
                  </span>
                  <span className="text-right text-slate-500 text-[10px] relative z-10">
                    {safeFixed(ask.total, symbol === 'BTC/USD' ? 2 : 0)}
                  </span>
                </div>
              ))}
            </div>

            {/* Mid Price Spread Divider */}
            <div className="my-1.5 py-1 px-2 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs">
              <span className="text-[10px] text-slate-400 font-bold">MID MARKET</span>
              <span className="text-slate-100 font-extrabold text-sm tracking-wider">
                ${safeFixed(currentPrice, symbol === 'BTC/USD' ? 1 : 2)}
              </span>
              <span className="text-[9px] text-slate-400">TICK: ${meta.tickSize}</span>
            </div>

            {/* Bids (Buyers - Green) */}
            <div className="flex-1 flex flex-col space-y-0.5 overflow-hidden">
              {bids.slice(0, 6).map((bid, i) => (
                <div key={i} className="relative grid grid-cols-3 px-1 py-0.5 text-emerald-300 items-center">
                  <div
                    className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 pointer-events-none rounded"
                    style={{ width: `${bid.percent || 0}%` }}
                  />
                  <span className="font-bold relative z-10 flex items-center gap-1">
                    {safeFixed(bid.price, symbol === 'BTC/USD' ? 1 : 2)}
                    {bid.isIceberg && (
                      <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded font-mono">
                        ICEBERG
                      </span>
                    )}
                  </span>
                  <span className="text-right text-slate-300 relative z-10">
                    {safeFixed(bid.amount, symbol === 'BTC/USD' ? 3 : 1)}
                  </span>
                  <span className="text-right text-slate-500 text-[10px] relative z-10">
                    {safeFixed(bid.total, symbol === 'BTC/USD' ? 2 : 0)}
                  </span>
                </div>
              ))}
            </div>

            {/* Imbalance Meter Bar */}
            <div className="mt-1 pt-1.5 border-t border-slate-800/80">
              <div className="flex h-1.5 w-full rounded overflow-hidden">
                <div style={{ width: `${bidRatio}%` }} className="bg-emerald-500" />
                <div style={{ width: `${askRatio}%` }} className="bg-rose-500" />
              </div>
            </div>
          </div>
        ) : (
          /* Live Time & Sales Tape */
          <div className="flex flex-col h-full font-mono text-[11px]">
            <div className="grid grid-cols-4 text-[10px] text-slate-500 border-b border-slate-800/80 pb-1 mb-1 px-1">
              <span>TIME</span>
              <span>PRICE ($)</span>
              <span className="text-right">SIZE</span>
              <span className="text-right">VAL ($)</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
              {trades.map((trade) => {
                const isBuy = trade.side === 'buy';
                return (
                  <div
                    key={trade.id}
                    className={`grid grid-cols-4 px-1 py-0.5 rounded items-center ${
                      trade.isBlockTrade ? 'bg-amber-500/10 border border-amber-500/30' : ''
                    }`}
                  >
                    <span className="text-slate-500 text-[10px]">{trade.time}</span>
                    <span className={`font-bold ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${safeFixed(trade.price, symbol === 'BTC/USD' ? 1 : 2)}
                    </span>
                    <span className="text-right text-slate-200">
                      {safeFixed(trade.amount, symbol === 'BTC/USD' ? 3 : 1)}
                    </span>
                    <span className="text-right text-slate-400 text-[10px] flex items-center justify-end gap-1">
                      ${Math.round(trade.usdValue || 0).toLocaleString()}
                      {trade.isBlockTrade && (
                        <Flame className="h-3 w-3 text-amber-400 fill-amber-400" title="Whale Block Execution" />
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
