import React, { useState } from 'react';
import { Position, WorkingOrder, TradeHistoryItem, AssetSymbol } from '../types/trading';
import { 
  ShieldCheck, 
  X, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  History, 
  Layers, 
  Clock,
  Scissors,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Lock
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface PositionManagerProps {
  positions?: Position[];
  orders?: WorkingOrder[];
  tradeHistory?: TradeHistoryItem[];
  onClosePosition: (positionId: string, partialRatio?: number) => void;
  onMoveSlToBreakeven: (positionId: string) => void;
  onCancelOrder: (orderId: string) => void;
}

const safeFixed = (val: number | undefined | null, digits: number = 2, fallback: string = '0.00'): string => {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return val.toFixed(digits);
};

export const PositionManager: React.FC<PositionManagerProps> = ({
  positions = [],
  orders = [],
  tradeHistory = [],
  onClosePosition,
  onMoveSlToBreakeven,
  onCancelOrder,
}) => {
  const [activeTab, setActiveTab] = useState<'POSITIONS' | 'ORDERS' | 'HISTORY'>('POSITIONS');

  const safePositions = positions || [];
  const safeOrders = orders || [];
  const safeHistory = tradeHistory || [];

  // Stats calculation
  const totalPnL = safePositions.reduce((acc, p) => acc + (p?.pnl || 0), 0);
  const winCount = safeHistory.filter((t) => (t?.pnl || 0) > 0).length;
  const winRate = safeHistory.length > 0 ? Math.round((winCount / safeHistory.length) * 100) : 0;
  const totalRealizedPnl = safeHistory.reduce((acc, t) => acc + (t?.pnl || 0), 0);

  return (
    <div className="flex flex-col bg-[#0b0e14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 bg-[#0d121c]">
        <div className="flex items-center gap-1.5">
          <button
            id="tab-positions-btn"
            onClick={() => setActiveTab('POSITIONS')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'POSITIONS'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>ACTIVE POSITIONS ({safePositions.length})</span>
            {safePositions.length > 0 && (
              <span
                className={`text-[10px] font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                ({totalPnL >= 0 ? '+' : ''}${safeFixed(totalPnL, 2)})
              </span>
            )}
          </button>

          <button
            id="tab-orders-btn"
            onClick={() => setActiveTab('ORDERS')}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'ORDERS'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            WORKING ORDERS ({safeOrders.length})
          </button>

          <button
            id="tab-history-btn"
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
              activeTab === 'HISTORY'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="h-3 w-3" />
            <span>TRADE JOURNAL ({safeHistory.length})</span>
          </button>
        </div>

        {/* Win Rate Quick Stat */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span>WIN RATE:</span>
          <span className="text-emerald-400 font-bold">{winRate}%</span>
          <span>•</span>
          <span>REALIZED PNL:</span>
          <span className={`font-bold ${totalRealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalRealizedPnl >= 0 ? '+' : ''}${safeFixed(totalRealizedPnl, 2)}
          </span>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-3">
        {activeTab === 'POSITIONS' && (
          safePositions.length === 0 ? (
            <div className="py-8 text-center text-slate-500 font-mono text-xs">
              No active intraday positions currently open.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500">
                    <th className="pb-2">ASSET / SIDE</th>
                    <th className="pb-2">CONTRACT SIZE</th>
                    <th className="pb-2">ENTRY PRICE</th>
                    <th className="pb-2">MARK PRICE</th>
                    <th className="pb-2">LIQ. PRICE</th>
                    <th className="pb-2">MARGIN (LEV)</th>
                    <th className="pb-2">UNREALIZED PNL</th>
                    <th className="pb-2 text-right">MANAGE / CLOSE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {safePositions.map((pos) => {
                    const isBuy = pos.side === 'BUY';
                    const isPos = pos.pnl >= 0;

                    return (
                      <tr key={pos.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                isBuy
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              }`}
                            >
                              {pos.side}
                            </span>
                            <span className="font-bold text-slate-200">{pos.symbol}</span>
                            <span className="text-[10px] text-slate-500">({pos.product})</span>
                          </div>
                        </td>

                        <td className="py-2.5 text-slate-300 font-semibold">
                          {pos.size} {pos.symbol === 'BTC/USD' ? 'BTC' : 'LOTS'}
                        </td>

                        <td className="py-2.5 text-slate-300">
                          ${safeFixed(pos.entryPrice, pos.symbol === 'BTC/USD' ? 1 : 2)}
                        </td>

                        <td className="py-2.5 text-slate-200 font-bold">
                          ${safeFixed(pos.currentPrice, pos.symbol === 'BTC/USD' ? 1 : 2)}
                        </td>

                        <td className="py-2.5 text-amber-400 font-semibold">
                          ${safeFixed(pos.liquidationPrice, pos.symbol === 'BTC/USD' ? 1 : 2)}
                        </td>

                        <td className="py-2.5 text-slate-400">
                          ${safeFixed(pos.margin, 0)} ({pos.leverage}x)
                        </td>

                        <td className="py-2.5">
                          <div className={`font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPos ? '+' : ''}${safeFixed(pos.pnl, 2)} ({isPos ? '+' : ''}{safeFixed(pos.pnlPercent, 2)}%)
                          </div>
                        </td>

                        <td className="py-2.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                onMoveSlToBreakeven(pos.id);
                                soundFx.playClick();
                              }}
                              title="Move Stop Loss to Breakeven (Risk-Free)"
                              className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold transition-all"
                            >
                              BE SL
                            </button>

                            <button
                              onClick={() => {
                                onClosePosition(pos.id, 0.5);
                                soundFx.playClick();
                              }}
                              title="Close 50% Position to Lock Profits"
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-all"
                            >
                              50%
                            </button>

                            <button
                              onClick={() => {
                                onClosePosition(pos.id);
                                soundFx.playClick();
                              }}
                              title="Market Close Entire Position"
                              className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[10px] font-bold transition-all"
                            >
                              FLATTEN
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'ORDERS' && (
          safeOrders.length === 0 ? (
            <div className="py-8 text-center text-slate-500 font-mono text-xs">
              No pending working limit orders.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500">
                    <th className="pb-2">ORDER ID</th>
                    <th className="pb-2">ASSET</th>
                    <th className="pb-2">SIDE</th>
                    <th className="pb-2">TYPE</th>
                    <th className="pb-2">LIMIT PRICE</th>
                    <th className="pb-2">SIZE</th>
                    <th className="pb-2 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {safeOrders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2 text-slate-500 text-[10px]">{ord.id}</td>
                      <td className="py-2 font-bold text-slate-200">{ord.symbol}</td>
                      <td className="py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ord.side === 'BUY'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {ord.side}
                        </span>
                      </td>
                      <td className="py-2 text-slate-400">{ord.type}</td>
                      <td className="py-2 text-slate-200 font-bold">${safeFixed(ord.price, 2)}</td>
                      <td className="py-2 text-slate-300">{ord.size}</td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => {
                            onCancelOrder(ord.id);
                            soundFx.playClick();
                          }}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 text-[10px]"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'HISTORY' && (
          safeHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-500 font-mono text-xs">
              Trade journal is empty. Closed trades will appear here with execution logs.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500">
                    <th className="pb-2">TIME</th>
                    <th className="pb-2">ASSET</th>
                    <th className="pb-2">SIDE</th>
                    <th className="pb-2">ENTRY</th>
                    <th className="pb-2">EXIT</th>
                    <th className="pb-2">SIZE</th>
                    <th className="pb-2">REALIZED PNL</th>
                    <th className="pb-2 text-right">REASON</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {safeHistory.map((item) => {
                    const isPos = item.pnl >= 0;
                    return (
                      <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-2 text-slate-500 text-[10px]">{item.exitTime}</td>
                        <td className="py-2 font-bold text-slate-200">{item.symbol}</td>
                        <td className="py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.side === 'BUY'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {item.side}
                          </span>
                        </td>
                        <td className="py-2 text-slate-400">${safeFixed(item.entryPrice, 2)}</td>
                        <td className="py-2 text-slate-200 font-bold">${safeFixed(item.exitPrice, 2)}</td>
                        <td className="py-2 text-slate-300">{item.size}</td>
                        <td className="py-2">
                          <span className={`font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPos ? '+' : ''}${safeFixed(item.pnl, 2)}
                          </span>
                        </td>
                        <td className="py-2 text-right text-slate-400 text-[10px]">{item.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>
    </div>
  );
};
