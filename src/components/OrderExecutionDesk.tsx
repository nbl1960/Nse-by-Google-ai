import React, { useState, useEffect } from 'react';
import { 
  AssetSymbol, 
  AccountStats, 
  InstitutionalSetup, 
  ProductType, 
  INSTRUMENT_METAS,
  BrokerConnection 
} from '../types/trading';
import { 
  ShieldCheck, 
  Sliders, 
  ArrowUpRight, 
  ArrowDownRight,
  Calculator,
  Lock,
  Zap,
  Layers,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Scale
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface OrderExecutionDeskProps {
  symbol: AssetSymbol;
  currentPrice?: number;
  accountStats: AccountStats;
  brokerConfig: BrokerConnection;
  onExecuteTrade: (params: {
    symbol: AssetSymbol;
    side: 'BUY' | 'SELL';
    type: 'MARKET' | 'LIMIT';
    product: ProductType;
    price: number;
    size: number;
    lots: number;
    leverage: number;
    stopLoss?: number;
    takeProfit?: number;
  }) => void;
  primedSetup: InstitutionalSetup | null;
}

const safeFixed = (val: number | undefined | null, digits: number = 2, fallback: string = '0.00'): string => {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return val.toFixed(digits);
};

export const OrderExecutionDesk: React.FC<OrderExecutionDeskProps> = ({
  symbol,
  currentPrice: rawCurrentPrice,
  accountStats,
  brokerConfig,
  onExecuteTrade,
  primedSetup,
}) => {
  const meta = INSTRUMENT_METAS[symbol] || INSTRUMENT_METAS['BTC/USD'];
  const currentPrice = typeof rawCurrentPrice === 'number' && !isNaN(rawCurrentPrice) && rawCurrentPrice > 0
    ? rawCurrentPrice
    : (meta?.basePrice || 64850);

  // Order Parameters
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [product, setProduct] = useState<ProductType>('PERPETUAL_SWAP');
  const [limitPrice, setLimitPrice] = useState<number>(currentPrice);
  const [leverage, setLeverage] = useState<number>(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);

  // Default contract size
  const defaultSize = symbol === 'BTC/USD' ? 0.5 : 1.0;
  const [size, setSize] = useState<number>(defaultSize);

  // Bracket Order (Stop Loss & Take Profit)
  const isGold = symbol === 'XAU/USD';
  const defaultSlOffset = isGold ? 4.50 : 350;
  const defaultTpOffset = defaultSlOffset * 2.5;

  const [enableSl, setEnableSl] = useState<boolean>(true);
  const [stopLossPrice, setStopLossPrice] = useState<number>(
    Number((currentPrice - defaultSlOffset).toFixed(2))
  );

  const [enableTp, setEnableTp] = useState<boolean>(true);
  const [takeProfitPrice, setTakeProfitPrice] = useState<number>(
    Number((currentPrice + defaultTpOffset).toFixed(2))
  );

  // Synchronize when asset changes
  useEffect(() => {
    setLimitPrice(currentPrice);
    const newSize = symbol === 'BTC/USD' ? 0.5 : 1.0;
    setSize(newSize);
    const slOff = symbol === 'XAU/USD' ? 4.50 : 350;
    setStopLossPrice(Number((currentPrice - slOff).toFixed(2)));
    setTakeProfitPrice(Number((currentPrice + slOff * 2.5).toFixed(2)));
  }, [symbol]);

  // Synchronize with Primed Setup from Setup Generator
  useEffect(() => {
    if (primedSetup && primedSetup.asset === symbol) {
      const isBuy = primedSetup.signal.includes('BUY');
      setSide(isBuy ? 'BUY' : 'SELL');
      setOrderType('LIMIT');
      setLimitPrice(primedSetup.entryPrice);
      setStopLossPrice(primedSetup.stopLoss);
      setTakeProfitPrice(primedSetup.takeProfit2);
      setEnableSl(true);
      setEnableTp(true);
      if (primedSetup.recommendedSize) {
        setSize(primedSetup.recommendedSize);
      }
    }
  }, [primedSetup, symbol]);

  // Calculate Notional Value, Required Margin, and Potential Risk / Reward
  const effectivePrice = orderType === 'MARKET' ? currentPrice : limitPrice;
  const contractMultiplier = symbol === 'XAU/USD' ? 100 : 1; // 1 Lot Gold = 100 oz
  const notionalValue = size * effectivePrice * contractMultiplier;
  const requiredMargin = notionalValue / leverage;

  const riskPerUnit = enableSl ? Math.abs(effectivePrice - stopLossPrice) : 0;
  const rewardPerUnit = enableTp ? Math.abs(takeProfitPrice - effectivePrice) : 0;
  const totalRiskUsd = riskPerUnit * size * contractMultiplier;
  const totalRewardUsd = rewardPerUnit * size * contractMultiplier;
  const calculatedRr = totalRiskUsd > 0 ? (totalRewardUsd / totalRiskUsd).toFixed(2) : '--';

  // Apply Risk % Rule (1% or 2% of equity auto-sizing)
  const applyRiskSizing = (riskPercent: number) => {
    const riskBudget = (accountStats.equity * riskPercent) / 100;
    if (riskPerUnit > 0) {
      const targetUnits = riskBudget / (riskPerUnit * contractMultiplier);
      const rounded = symbol === 'BTC/USD' 
        ? Math.max(0.01, Number(targetUnits.toFixed(2)))
        : Math.max(0.1, Number(targetUnits.toFixed(1)));
      setSize(rounded);
      soundFx.playClick();
    }
  };

  const handleExecute = () => {
    if (requiredMargin > accountStats.freeMargin) {
      soundFx.playWarning();
      alert(`Insufficient Free Margin. Required: $${safeFixed(requiredMargin, 2)}, Available: $${safeFixed(accountStats.freeMargin, 2)}`);
      return;
    }

    setIsSubmitting(true);
    soundFx.playClick();

    setTimeout(() => {
      onExecuteTrade({
        symbol,
        side,
        type: orderType,
        product,
        price: effectivePrice,
        size,
        lots: size,
        leverage,
        stopLoss: enableSl ? stopLossPrice : undefined,
        takeProfit: enableTp ? takeProfitPrice : undefined,
      });

      setIsSubmitting(false);
      setOrderSuccessMsg(
        `Filled ${side} ${size} ${symbol === 'BTC/USD' ? 'BTC' : 'Lots'} @ $${safeFixed(effectivePrice, symbol === 'BTC/USD' ? 1 : 2)}`
      );

      soundFx.playSuccess();

      setTimeout(() => setOrderSuccessMsg(null), 3500);
    }, 180);
  };

  return (
    <div className="flex flex-col bg-[#0b0e14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Execution Desk Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-[#0d121c]">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Zap className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wider">
              DMA ORDER EXECUTION DESK
            </h3>
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
              <span>ROUTE:</span>
              <span className="text-emerald-400 font-semibold">{brokerConfig.brokerName}</span>
              <span>•</span>
              <span className="text-slate-300">0.00% MAKER / 0.02% TAKER</span>
            </div>
          </div>
        </div>

        {/* Live Broker Indicator */}
        <div className="flex items-center gap-1.5 font-mono text-[10px] bg-slate-900 border border-slate-800 px-2 py-1 rounded">
          <Radio className="h-2.5 w-2.5 text-emerald-400 animate-ping" />
          <span className="text-slate-300">LATENCY: {brokerConfig.latencyMs}ms</span>
        </div>
      </div>

      <div className="p-4 space-y-3.5">
        {/* Buy / Sell Direct Side Selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            id="order-side-buy-btn"
            onClick={() => {
              setSide('BUY');
              soundFx.playClick();
            }}
            className={`py-2 rounded-lg font-mono font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              side === 'BUY'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-[#0f1420] text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-emerald-300'
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>BUY / LONG</span>
          </button>

          <button
            id="order-side-sell-btn"
            onClick={() => {
              setSide('SELL');
              soundFx.playClick();
            }}
            className={`py-2 rounded-lg font-mono font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              side === 'SELL'
                ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                : 'bg-[#0f1420] text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-rose-300'
            }`}
          >
            <ArrowDownRight className="h-4 w-4" />
            <span>SELL / SHORT</span>
          </button>
        </div>

        {/* Product Contract Type & Order Type */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold mb-1 block">
              CONTRACT TYPE
            </label>
            <div className="flex rounded-md bg-[#0f1420] border border-slate-800 p-0.5">
              {(['PERPETUAL_SWAP', 'ISOLATED_MARGIN', 'PHYSICAL_SPOT'] as ProductType[]).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setProduct(p);
                    soundFx.playClick();
                  }}
                  className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${
                    product === p
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {p === 'PERPETUAL_SWAP' ? 'PERP SWAP' : p === 'ISOLATED_MARGIN' ? 'ISOLATED' : 'SPOT'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase font-semibold mb-1 block">
              EXECUTION TYPE
            </label>
            <div className="flex rounded-md bg-[#0f1420] border border-slate-800 p-0.5">
              {(['MARKET', 'LIMIT'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setOrderType(t);
                    soundFx.playClick();
                  }}
                  className={`flex-1 py-1 text-[10px] font-bold rounded transition-all ${
                    orderType === t
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Leverage & Limit Price Input */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          {orderType === 'LIMIT' ? (
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold mb-1 block">
                LIMIT PRICE ($)
              </label>
              <input
                type="number"
                step={meta.tickSize}
                value={limitPrice}
                onChange={(e) => setLimitPrice(parseFloat(e.target.value) || currentPrice)}
                className="w-full rounded bg-[#0f1420] border border-slate-800 px-3 py-1.5 text-xs text-slate-100 font-bold focus:border-cyan-500 focus:outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="text-[10px] text-slate-400 uppercase font-semibold mb-1 block">
                BEST MARKET PRICE ($)
              </label>
              <div className="w-full rounded bg-[#0f1420] border border-slate-800 px-3 py-1.5 text-xs text-emerald-400 font-bold flex items-center justify-between">
                <span>${safeFixed(currentPrice, symbol === 'BTC/USD' ? 1 : 2)}</span>
                <span className="text-[9px] text-slate-500 font-normal">SLIPPAGE &lt; 0.01%</span>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400 uppercase font-semibold">
                LEVERAGE
              </label>
              <span className="text-[10px] text-amber-400 font-bold">{leverage}x</span>
            </div>
            <div className="flex items-center gap-1">
              {[1, 5, 10, 20, 50].map((lev) => (
                <button
                  key={lev}
                  onClick={() => {
                    setLeverage(lev);
                    soundFx.playClick();
                  }}
                  className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${
                    leverage === lev
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-[#0f1420] text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {lev}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Position Sizing & Auto Risk Sizing */}
        <div>
          <div className="flex items-center justify-between mb-1 text-[10px] font-mono">
            <span className="text-slate-400 uppercase font-semibold">
              CONTRACT SIZE ({symbol === 'BTC/USD' ? 'BTC' : 'LOTS (100 OZ)'})
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">RISK SIZING:</span>
              <button
                onClick={() => applyRiskSizing(0.5)}
                className="text-cyan-400 hover:text-cyan-300 underline font-semibold"
              >
                0.5%
              </button>
              <button
                onClick={() => applyRiskSizing(1.0)}
                className="text-cyan-400 hover:text-cyan-300 underline font-semibold"
              >
                1.0%
              </button>
              <button
                onClick={() => applyRiskSizing(2.0)}
                className="text-cyan-400 hover:text-cyan-300 underline font-semibold"
              >
                2.0%
              </button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 mb-1.5 font-mono">
            {(symbol === 'BTC/USD' ? [0.1, 0.25, 0.5, 1.0] : [0.5, 1.0, 2.0, 5.0]).map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  setSize(preset);
                  soundFx.playClick();
                }}
                className={`py-1 rounded text-[10px] font-bold border transition-all ${
                  size === preset
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                    : 'bg-[#0f1420] text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {preset} {symbol === 'BTC/USD' ? 'BTC' : 'LOT'}
              </button>
            ))}
          </div>

          <input
            type="number"
            step={symbol === 'BTC/USD' ? 0.01 : 0.1}
            min={symbol === 'BTC/USD' ? 0.01 : 0.1}
            value={size}
            onChange={(e) => setSize(Math.max(0.01, parseFloat(e.target.value) || 0.1))}
            className="w-full rounded bg-[#0f1420] border border-slate-800 px-3 py-1.5 text-xs text-slate-100 font-bold font-mono focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* Bracket Orders (Stop Loss & Take Profit) */}
        <div className="p-3 rounded-lg bg-[#090d14] border border-slate-800/80 space-y-2.5 font-mono text-xs">
          {/* SL Row */}
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-rose-400 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={enableSl}
                onChange={(e) => setEnableSl(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-0"
              />
              <span>STOP LOSS (SL)</span>
            </label>
            <input
              type="number"
              disabled={!enableSl}
              step={meta.tickSize}
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(parseFloat(e.target.value) || 0)}
              className="w-28 rounded bg-[#0f1420] border border-slate-800 px-2 py-1 text-right text-xs text-rose-300 font-bold disabled:opacity-40"
            />
          </div>

          {/* TP Row */}
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-1.5 text-emerald-400 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={enableTp}
                onChange={(e) => setEnableTp(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0"
              />
              <span>TAKE PROFIT (TP)</span>
            </label>
            <input
              type="number"
              disabled={!enableTp}
              step={meta.tickSize}
              value={takeProfitPrice}
              onChange={(e) => setTakeProfitPrice(parseFloat(e.target.value) || 0)}
              className="w-28 rounded bg-[#0f1420] border border-slate-800 px-2 py-1 text-right text-xs text-emerald-300 font-bold disabled:opacity-40"
            />
          </div>
        </div>

        {/* Pre-Trade Risk & Margin HUD */}
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#0e1420] border border-slate-800 font-mono text-[11px]">
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">NOTIONAL VALUE</span>
            <span className="font-bold text-slate-200">${safeFixed(notionalValue, 2)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">REQUIRED MARGIN</span>
            <span className="font-bold text-amber-400">${safeFixed(requiredMargin, 2)}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">EST. RISK (LOSS)</span>
            <span className="font-bold text-rose-400">
              {enableSl ? `-$${safeFixed(totalRiskUsd, 2)}` : 'UNLIMITED'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[9px] uppercase">EST. REWARD (PROFIT)</span>
            <span className="font-bold text-emerald-400">
              {enableTp ? `+$${safeFixed(totalRewardUsd, 2)} (${calculatedRr} R:R)` : '--'}
            </span>
          </div>
        </div>

        {/* Success Message Banner */}
        {orderSuccessMsg && (
          <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{orderSuccessMsg}</span>
          </div>
        )}

        {/* Execution Trigger Button */}
        <button
          id="execute-order-btn"
          onClick={handleExecute}
          disabled={isSubmitting}
          className={`w-full py-3 rounded-lg font-mono font-extrabold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-98 ${
            side === 'BUY'
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
              : 'bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-rose-500/20'
          }`}
        >
          <Zap className="h-4 w-4" />
          <span>
            {isSubmitting
              ? 'ROUTING DMA PACKET...'
              : `SEND ${side} ${size} ${symbol === 'BTC/USD' ? 'BTC' : 'LOTS'} @ $${safeFixed(effectivePrice, symbol === 'BTC/USD' ? 1 : 2)}`}
          </span>
        </button>
      </div>
    </div>
  );
};
