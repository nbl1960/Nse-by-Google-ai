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
  Scissors
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

  return (
    <div className="flex flex-col bg-[#0b0e14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Tab Navigation */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 bg-[#0d121c]">
        <div className="flex items-center gap-1.5">
          <button
            id="tab-positions-btn"
            onClick={() => setActiveTab('POSITIONS')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
              activeTab === 'POSITIONS'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>POSITIONS ({positions.length})</span>
            {positions.length > 0 && (
              <span
                className={`text-[10px] font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                ({totalPnL >= 0 ? '+' : ''}₹{safeFixed(totalPnL, 2)})
              </span>
            )}
          </button>

          <button
            id="tab-orders-btn"
            onClick={() => setActiveTab('ORDERS')}
            className={`px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
              activeTab === 'ORDERS'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            WORKING ORDERS ({orders.length})
          </button>

          <button
            id="tab-history-btn"
            onClick={() => setActiveTab('HISTORY')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
              activeTab === 'HISTORY'
                ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="h-3 w-3" />
            <span>TRADE JOURNAL ({tradeHistory.length})</span>
          </button>
        </div>

        {/* Win Rate Quick Stat */}
        <div className="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400">
          <span>JOURNAL WIN RATE:</span>
          <span className="text-emerald-400 font-bold">{winRate}%</span>
        </div>
      </div>

      {/* Tab Panels */}
      <div className="p-3 overflow-x-auto min-h-[140px] max-h-[220px] overflow-y-auto">
        {activeTab === 'POSITIONS' && (
          <div>
            {positions.length === 0 ? (
              <div className="flex h-28 flex-col items-center justify-center text-slate-500 font-mono text-xs">
                <span>No active open positions in intraday portfolio.</span>
                <span className="text-[11px] text-slate-600 mt-1">
                  Place an intraday MIS or carry trade on the execution desk to enter.
                </span>
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase">
                    <th className="pb-1.5">INSTRUMENT</th>
                    <th className="pb-1.5">SIDE</th>
                    <th className="pb-1.5">PRODUCT</th>
                    <th className="pb-1.5 text-right">SIZE / LOTS</th>
                    <th className="pb-1.5 text-right">ENTRY (₹)</th>
                    <th className="pb-1.5 text-right">CURRENT (₹)</th>
                    <th className="pb-1.5 text-right">UNREALIZED P&L</th>
                    <th className="pb-1.5 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {positions.map((pos) => {
                    const isProfit = pos.pnl >= 0;
                    return (
                      <tr key={pos.id} className="hover:bg-slate-900/40">
                        <td className="py-2 font-bold text-slate-200">
                          {pos.symbol}
                        </td>
                        <td className="py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              pos.side === 'BUY'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {pos.side}
                          </span>
                        </td>
                        <td className="py-2 text-cyan-300 font-semibold">
                          {pos.product || 'MIS'}
                        </td>
                        <td className="py-2 text-right text-slate-300">
                          {pos.lots ? `${pos.lots}L (${pos.size})` : `${pos.size} Qty`}
                        </td>
                        <td className="py-2 text-right text-slate-300">
                          ₹{safeFixed(pos.entryPrice, 1)}
                        </td>
                        <td className="py-2 text-right font-bold text-slate-100">
                          ₹{safeFixed(pos.currentPrice, 1)}
                        </td>
                        <td
                          className={`py-2 text-right font-bold ${
                            isProfit ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isProfit ? '+' : ''}₹{safeFixed(pos.pnl, 2)} ({isProfit ? '+' : ''}{safeFixed(pos.pnlPercent, 2)}%)
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => {
                                onMoveSlToBreakeven(pos.id);
                                soundFx.playBreakevenAlert();
                              }}
                              title="Set Stop Loss to Entry Price (Breakeven)"
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] border border-slate-700"
                            >
                              BE SL
                            </button>
                            <button
                              onClick={() => {
                                onClosePosition(pos.id, 0.5);
                                soundFx.playOrderFill();
                              }}
                              title="Take 50% Partial Profits"
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10px] border border-slate-700"
                            >
                              50% Scale
                            </button>
                            <button
                              onClick={() => {
                                onClosePosition(pos.id);
                                soundFx.playOrderFill();
                              }}
                              className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-300 text-[10px] border border-rose-500/40 font-bold"
                            >
                              Square-off
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'ORDERS' && (
          <div>
            {orders.length === 0 ? (
              <div className="flex h-28 flex-col items-center justify-center text-slate-500 font-mono text-xs">
                <span>No active pending limit orders waiting at exchange.</span>
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase">
                    <th className="pb-1.5">SYMBOL</th>
                    <th className="pb-1.5">TYPE</th>
                    <th className="pb-1.5">SIDE</th>
                    <th className="pb-1.5 text-right">LOTS / QTY</th>
                    <th className="pb-1.5 text-right">TRIGGER / LIMIT (₹)</th>
                    <th className="pb-1.5 text-right">TIME</th>
                    <th className="pb-1.5 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {orders.map((ord) => (
                    <tr key={ord.id} className="hover:bg-slate-900/40">
                      <td className="py-2 font-bold text-slate-200">{ord.symbol}</td>
                      <td className="py-2 text-slate-400">{ord.type}</td>
                      <td className="py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ord.side === 'BUY'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {ord.side}
                        </span>
                      </td>
                      <td className="py-2 text-right text-slate-300">{ord.size}</td>
                      <td className="py-2 text-right font-bold text-slate-100">
                        ₹{safeFixed(ord.price, 1)}
                      </td>
                      <td className="py-2 text-right text-slate-500 text-[10px]">
                        {ord.createdAt ? new Date(ord.createdAt).toLocaleTimeString() : '—'}
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() => onCancelOrder(ord.id)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-rose-400 text-[10px]"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <div>
            {tradeHistory.length === 0 ? (
              <div className="flex h-28 flex-col items-center justify-center text-slate-500 font-mono text-xs">
                <span>No trades executed in current session journal.</span>
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase">
                    <th className="pb-1.5">TIME</th>
                    <th className="pb-1.5">SYMBOL</th>
                    <th className="pb-1.5">SIDE</th>
                    <th className="pb-1.5 text-right">SIZE</th>
                    <th className="pb-1.5 text-right">ENTRY (₹)</th>
                    <th className="pb-1.5 text-right">EXIT (₹)</th>
                    <th className="pb-1.5 text-right">NET REALIZED P&L</th>
                    <th className="pb-1.5 text-right">RATIONALE</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {tradeHistory.map((th) => {
                    const isWin = (th.pnl || 0) >= 0;
                    return (
                      <tr key={th.id} className="hover:bg-slate-900/40">
                        <td className="py-2 text-slate-500 text-[10px]">
                          {th.exitTime ? new Date(th.exitTime).toLocaleTimeString() : '—'}
                        </td>
                        <td className="py-2 font-bold text-slate-200">{th.symbol}</td>
                        <td className="py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              th.side === 'BUY'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            {th.side}
                          </span>
                        </td>
                        <td className="py-2 text-right text-slate-300">{th.size}</td>
                        <td className="py-2 text-right text-slate-400">
                          ₹{safeFixed(th.entryPrice, 1)}
                        </td>
                        <td className="py-2 text-right font-bold text-slate-200">
                          ₹{safeFixed(th.exitPrice, 1)}
                        </td>
                        <td
                          className={`py-2 text-right font-bold ${
                            isWin ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {isWin ? '+' : ''}₹{safeFixed(th.pnl, 2)}
                        </td>
                        <td className="py-2 text-right text-slate-400 text-[10px]">
                          {th.exitReason || 'Intraday Target Reached'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
