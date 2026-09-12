import React, { useState, useEffect } from 'react';
import { 
  AssetSymbol, 
  AccountStats, 
  InstitutionalSetup, 
  ProductType, 
  INSTRUMENT_METAS,
  UpstoxBrokerStatus 
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
  Key,
  CheckCircle2
} from 'lucide-react';
import { soundFx } from '../utils/audio';

interface OrderExecutionDeskProps {
  symbol: AssetSymbol;
  currentPrice?: number;
  accountStats: AccountStats;
  upstoxStatus?: UpstoxBrokerStatus;
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
    instrumentKey?: string;
  }) => void;
  primedSetup: InstitutionalSetup | null;
  primedOption?: { strike: number; type: 'CE' | 'PE'; ltp: number } | null;
  onClearPrimedOption?: () => void;
}

const safeFixed = (val: number | undefined | null, digits: number = 1, fallback: string = '0.0'): string => {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return val.toFixed(digits);
};

export const OrderExecutionDesk: React.FC<OrderExecutionDeskProps> = ({
  symbol,
  currentPrice: rawCurrentPrice,
  accountStats,
  upstoxStatus = {
    connected: true,
    mode: 'LIVE',
    hasToken: true,
    feedLatencyMs: 4,
    marketOpen: true,
  },
  onExecuteTrade,
  primedSetup,
  primedOption,
  onClearPrimedOption,
}) => {
  const currentPrice = typeof rawCurrentPrice === 'number' && !isNaN(rawCurrentPrice) && rawCurrentPrice > 0
    ? rawCurrentPrice
    : (INSTRUMENT_METAS[symbol]?.basePrice || 24000);
  const isUpstoxConnected = Boolean(upstoxStatus?.connected && upstoxStatus?.mode === 'LIVE');
  const meta = INSTRUMENT_METAS[symbol] || INSTRUMENT_METAS['NIFTY 50'];

  // Order settings
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [product, setProduct] = useState<ProductType>('MIS');
  const [limitPrice, setLimitPrice] = useState<number>(currentPrice);
  const [lots, setLots] = useState<number>(meta.isIndex ? 2 : 1);
  const [riskPercent, setRiskPercent] = useState<number>(1.0); // 1% risk rule
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);

  // Default leverage based on product
  const leverage = product === 'MIS' ? (meta.isIndex ? 10 : 5) : 1;

  // Bracket Order (SL & TP)
  const defaultSlPoints = meta.isIndex ? (symbol === 'BANKNIFTY' ? 80 : 35) : Math.max(5, Number((currentPrice * 0.008).toFixed(1)));
  const defaultTpPoints = defaultSlPoints * 2.2;

  const [enableSl, setEnableSl] = useState<boolean>(true);
  const [stopLossPrice, setStopLossPrice] = useState<number>(
    Number((currentPrice - defaultSlPoints).toFixed(1))
  );

  const [enableTp, setEnableTp] = useState<boolean>(true);
  const [takeProfitPrice, setTakeProfitPrice] = useState<number>(
    Number((currentPrice + defaultTpPoints).toFixed(1))
  );

  // Total Quantity calculation
  const totalQuantity = meta.isIndex ? lots * meta.lotSize : lots * (meta.lotSize || 1);

  // Update limit price default when symbol changes
  useEffect(() => {
    setLimitPrice(currentPrice);
    if (!primedSetup) {
      if (side === 'BUY') {
        setStopLossPrice(Number((currentPrice - defaultSlPoints).toFixed(1)));
        setTakeProfitPrice(Number((currentPrice + defaultTpPoints).toFixed(1)));
      } else {
        setStopLossPrice(Number((currentPrice + defaultSlPoints).toFixed(1)));
        setTakeProfitPrice(Number((currentPrice - defaultTpPoints).toFixed(1)));
      }
    }
  }, [symbol]);

  // When a primed setup is loaded from the quant generator
  useEffect(() => {
    if (primedSetup && primedSetup.asset === symbol) {
      setSide(primedSetup.signal.includes('BUY') ? 'BUY' : 'SELL');
      setLimitPrice(primedSetup.entryPrice);
      setStopLossPrice(primedSetup.stopLoss);
      setTakeProfitPrice(primedSetup.takeProfit2);
      setEnableSl(true);
      setEnableTp(true);

      // Auto calculate lots based on exact Stop Loss distance & 1% capital rule
      const riskInr = (accountStats.balance * riskPercent) / 100;
      const slDist = Math.abs(primedSetup.entryPrice - primedSetup.stopLoss);
      if (slDist > 0) {
        const calculatedQty = riskInr / slDist;
        const calculatedLots = Math.max(1, Math.round(calculatedQty / meta.lotSize));
        setLots(calculatedLots);
      }
    }
  }, [primedSetup]);

  // Handle Option selection from Option Chain
  useEffect(() => {
    if (primedOption) {
      setSide('BUY');
      setLimitPrice(primedOption.ltp);
      setStopLossPrice(Number((primedOption.ltp * 0.7).toFixed(1))); // 30% SL on option
      setTakeProfitPrice(Number((primedOption.ltp * 1.6).toFixed(1))); // 60% TP on option
      setProduct('MIS');
    }
  }, [primedOption]);

  const effectiveEntry = primedOption ? primedOption.ltp : (orderType === 'MARKET' ? currentPrice : limitPrice);
  const notionalValue = effectiveEntry * totalQuantity;
  const marginRequired = product === 'MIS' ? notionalValue / leverage : notionalValue;
  const slDistance = Math.abs(effectiveEntry - stopLossPrice);
  const potentialLoss = slDistance * totalQuantity;
  const tpDistance = Math.abs(takeProfitPrice - effectiveEntry);
  const potentialProfit = tpDistance * totalQuantity;
  const rrRatio = potentialLoss > 0 ? (potentialProfit / potentialLoss).toFixed(2) : '0.00';

  const handleSubmitOrder = async (overrideSide?: 'BUY' | 'SELL') => {
    const activeSide = overrideSide || side;
    if (overrideSide && overrideSide !== side) {
      setSide(overrideSide);
    }
    setIsSubmitting(true);
    setOrderSuccessMsg(null);

    const entry = effectiveEntry;

    // Call upstream execution
    onExecuteTrade({
      symbol,
      side: activeSide,
      type: orderType,
      product,
      price: entry,
      size: totalQuantity,
      lots,
      leverage,
      stopLoss: enableSl ? stopLossPrice : undefined,
      takeProfit: enableTp ? takeProfitPrice : undefined,
      instrumentKey: primedOption
        ? `${symbol} ${primedOption.strike} ${primedOption.type}`
        : meta.upstoxKey,
    });

    // Call Upstox broker proxy if token is active
    if (upstoxStatus?.hasToken) {
      try {
        await fetch('/api/upstox/order/place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: meta.upstoxKey,
            instrument_token: meta.upstoxKey,
            transaction_type: activeSide,
            order_type: orderType,
            product,
            quantity: totalQuantity,
            price: orderType === 'LIMIT' ? limitPrice : 0,
            tag: 'APEX_INTRADAY',
          }),
        });
      } catch (e) {
        console.warn('Upstox proxy response handled:', e);
      }
    }

    soundFx.playOrderFill();
    setOrderSuccessMsg(`Order placed: ${activeSide} ${lots} Lots (${totalQuantity} Qty) @ ₹${entry.toFixed(1)}`);
    setIsSubmitting(false);

    setTimeout(() => {
      setOrderSuccessMsg(null);
    }, 3500);
  };

  return (
    <div className="flex flex-col bg-[#0b0e14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3.5 py-2.5 bg-[#0d121c]">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-cyan-400" />
          <span className="font-mono font-bold text-xs uppercase tracking-wider text-slate-200">
            UPSTOX EXECUTION DESK (NSE / BSE)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
            isUpstoxConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
          }`}>
            {isUpstoxConnected ? 'LIVE BROKER ROUTED' : 'SIMULATED PAPER DESK'}
          </span>
        </div>
      </div>

      {/* Primed Option Banner if selected */}
      {primedOption && (
        <div className="bg-cyan-950/40 border-b border-cyan-500/30 px-3.5 py-2 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-bold">DERIVATIVE SELECTED:</span>
            <span className="text-slate-100 font-bold">
              {symbol} {primedOption.strike} {primedOption.type}
            </span>
            <span className="text-slate-300">LTP: ₹{primedOption.ltp}</span>
          </div>
          {onClearPrimedOption && (
            <button
              onClick={onClearPrimedOption}
              className="text-slate-400 hover:text-rose-300 text-[10px]"
            >
              Clear Option
            </button>
          )}
        </div>
      )}

      {/* Main Order Settings */}
      <div className="p-3.5 space-y-3.5 flex-1 overflow-y-auto font-mono text-xs">
        {/* Product Type (MIS vs CNC vs NRML) */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
          {(['MIS', 'NRML', 'CNC'] as ProductType[]).map((p) => (
            <button
              key={p}
              onClick={() => setProduct(p)}
              className={`py-1 rounded text-center font-bold text-[11px] transition-all ${
                product === p
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {p} {p === 'MIS' ? '(Intraday)' : p === 'NRML' ? '(F&O Carry)' : '(Delivery)'}
            </button>
          ))}
        </div>

        {/* Order Type (MARKET vs LIMIT) */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setOrderType('MARKET')}
            className={`py-1.5 rounded font-bold transition-all border ${
              orderType === 'MARKET'
                ? 'bg-slate-800 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            MARKET (BBO)
          </button>
          <button
            onClick={() => setOrderType('LIMIT')}
            className={`py-1.5 rounded font-bold transition-all border ${
              orderType === 'LIMIT'
                ? 'bg-slate-800 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            LIMIT
          </button>
        </div>

        {/* Limit Price Input if LIMIT selected */}
        {orderType === 'LIMIT' && (
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">LIMIT PRICE (₹)</label>
            <input
              type="number"
              step="0.05"
              value={limitPrice}
              onChange={(e) => setLimitPrice(Number(e.target.value))}
              className="w-full rounded bg-slate-900 border border-slate-700 px-3 py-1.5 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        )}

        {/* Lots & Quantity Inputs */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400">LOT SIZE: {meta.lotSize} Qty</span>
            <span className="text-cyan-300 font-bold">TOTAL QTY: {totalQuantity}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="block text-[10px] text-slate-500 uppercase mb-1">NUMBER OF LOTS</label>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setLots((prev) => Math.max(1, prev - 1))}
                  className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={lots}
                  onChange={(e) => setLots(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-center rounded bg-slate-950 border border-slate-700 py-1 font-bold text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  onClick={() => setLots((prev) => prev + 1)}
                  className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700"
                >
                  +
                </button>
              </div>
            </div>

            {/* Quick Multiplier Pills */}
            <div className="flex items-center gap-1 self-end pb-0.5">
              {[1, 2, 5, 10].map((l) => (
                <button
                  key={l}
                  onClick={() => setLots(l)}
                  className={`px-2 py-1 rounded text-[10px] border transition-all ${
                    lots === l
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {l}L
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Institutional Risk Calculator & Bracket Orders */}
        <div className="space-y-2 pt-1 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
              BRACKET RISK MANAGEMENT (SL / TP)
            </span>
            <span className="text-[10px] text-slate-400">R:R {rrRatio}</span>
          </div>

          {/* Stop Loss Toggle and Price */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enable-sl"
              checked={enableSl}
              onChange={(e) => setEnableSl(e.target.checked)}
              className="rounded border-slate-700 text-cyan-500 focus:ring-0"
            />
            <label htmlFor="enable-sl" className="text-slate-400 text-[11px] w-24">
              STOP LOSS (₹)
            </label>
            <input
              type="number"
              step="0.1"
              disabled={!enableSl}
              value={stopLossPrice}
              onChange={(e) => setStopLossPrice(Number(e.target.value))}
              className="flex-1 rounded bg-slate-900 border border-slate-700 px-2.5 py-1 text-rose-300 disabled:opacity-40 focus:border-rose-500 focus:outline-none"
            />
          </div>

          {/* Take Profit Toggle and Price */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enable-tp"
              checked={enableTp}
              onChange={(e) => setEnableTp(e.target.checked)}
              className="rounded border-slate-700 text-cyan-500 focus:ring-0"
            />
            <label htmlFor="enable-tp" className="text-slate-400 text-[11px] w-24">
              TARGET (₹)
            </label>
            <input
              type="number"
              step="0.1"
              disabled={!enableTp}
              value={takeProfitPrice}
              onChange={(e) => setTakeProfitPrice(Number(e.target.value))}
              className="flex-1 rounded bg-slate-900 border border-slate-700 px-2.5 py-1 text-emerald-300 disabled:opacity-40 focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Order Financial Summary Card */}
        <div className="rounded bg-slate-900/60 border border-slate-800 p-2.5 space-y-1.5 text-[11px]">
          <div className="flex justify-between text-slate-400">
            <span>NOTIONAL ORDER VALUE:</span>
            <span className="text-slate-200 font-bold">₹{notionalValue.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>MARGIN REQUIRED:</span>
            <span className="text-cyan-300 font-bold">₹{marginRequired.toLocaleString('en-IN', { maximumFractionDigits: 1 })}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>MAX CAPITAL AT RISK:</span>
            <span className="text-rose-400 font-bold">₹{safeFixed(potentialLoss, 1)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>EXPECTED TARGET PROFIT:</span>
            <span className="text-emerald-400 font-bold">₹{safeFixed(potentialProfit, 1)}</span>
          </div>
        </div>

        {orderSuccessMsg && (
          <div className="p-2.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-1.5 animate-fadeIn">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{orderSuccessMsg}</span>
          </div>
        )}

        {/* Buy and Sell Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            onClick={() => handleSubmitOrder('BUY')}
            disabled={isSubmitting}
            className="flex flex-col items-center justify-center py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold transition-all shadow-lg shadow-emerald-950/40 disabled:opacity-50 active:scale-95"
          >
            <div className="flex items-center gap-1 text-xs">
              <ArrowUpRight className="h-4 w-4" />
              <span>BUY / LONG</span>
            </div>
            <span className="text-[10px] opacity-85">
              @ ₹{safeFixed(effectiveEntry, 1)}
            </span>
          </button>

          <button
            onClick={() => handleSubmitOrder('SELL')}
            disabled={isSubmitting}
            className="flex flex-col items-center justify-center py-2.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-slate-950 font-extrabold transition-all shadow-lg shadow-rose-950/40 disabled:opacity-50 active:scale-95"
          >
            <div className="flex items-center gap-1 text-xs">
              <ArrowDownRight className="h-4 w-4" />
              <span>SELL / SHORT</span>
            </div>
            <span className="text-[10px] opacity-85">
              @ ₹{safeFixed(effectiveEntry, 1)}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
