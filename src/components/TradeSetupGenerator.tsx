import React, { useState } from 'react';
import { AssetSymbol, Candle, InstitutionalSetup, Timeframe, INSTRUMENT_METAS } from '../types/trading';
import {
  Sparkles,
  Target,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  CheckSquare,
  Percent,
  Send,
  RefreshCw,
  Cpu,
  Layers,
  Zap,
  Activity,
  Flame,
  Scale,
  MinusCircle
} from 'lucide-react';
import { soundFx } from '../utils/audio';
import { buildInstitutionalSetup, CONFLUENCE_THRESHOLD, DecisionEngineContext } from '../services/decisionEngine';

interface TradeSetupGeneratorProps {
  symbol: AssetSymbol;
  currentPrice?: number;
  timeframe: Timeframe;
  candles: Candle[];
  macroContext?: DecisionEngineContext;
  activeSetup: InstitutionalSetup | null;
  onApplySetupToOrderDesk: (setup: InstitutionalSetup) => void;
  onSetupGenerated: (setup: InstitutionalSetup) => void;
}

const safeFixed = (val: number | undefined | null, digits: number = 2, fallback: string = '--'): string => {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return val.toFixed(digits);
};

export const TradeSetupGenerator: React.FC<TradeSetupGeneratorProps> = ({
  symbol,
  currentPrice: rawPrice,
  timeframe,
  candles,
  macroContext,
  activeSetup,
  onApplySetupToOrderDesk,
  onSetupGenerated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<InstitutionalSetup | null>(null);

  const meta = INSTRUMENT_METAS[symbol] || INSTRUMENT_METAS['BTC/USD'];
  const currentPrice = typeof rawPrice === 'number' && !isNaN(rawPrice) && rawPrice > 0
    ? rawPrice
    : (meta?.basePrice || 64850);

  // Enforces the critical signal rule: BUY/SELL only survive if confluence >= threshold.
  // Anything else is clamped to NO_TRADE, regardless of what the AI response claims.
  const enforceThreshold = (candidate: InstitutionalSetup): InstitutionalSetup => {
    const score = typeof candidate.confluenceScore === 'number' ? candidate.confluenceScore : 0;
    const isBuyOrSell = candidate.signal === 'BUY' || candidate.signal === 'STRONG_BUY' || candidate.signal === 'SELL' || candidate.signal === 'STRONG_SELL';
    if (isBuyOrSell && score < CONFLUENCE_THRESHOLD) {
      return {
        ...candidate,
        signal: 'NO_TRADE',
        setupName: 'No Trade — Institutional Confluence Threshold Not Met',
      };
    }
    return candidate;
  };

  const handleGenerateTrade = async () => {
    setIsGenerating(true);

    // Validated, deterministic setup computed from live SMC/ICT structure, order flow,
    // VWAP/EMA, liquidity, macro context, options positioning, and risk.
    const localSetup = buildInstitutionalSetup(candles, symbol, timeframe, macroContext);

    try {
      const response = await fetch('/api/institutional-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset: symbol,
          currentPrice,
          timeframe,
          computedScore: localSetup.confluenceScore,
          computedSignal: localSetup.signal,
          computedSetup: localSetup,
        }),
      });

      const data = await response.json();
      if (data && data.analysis) {
        const setup = enforceThreshold({
          ...data.analysis,
          asset: symbol,
          timestamp: new Date().toLocaleTimeString(),
        });
        setModelUsed(data.source || 'Institutional Quant Engine');
        setLastGenerated(setup);
        if (setup.signal !== 'NO_TRADE') onSetupGenerated(setup);
        soundFx.playSignalAlert();
      } else {
        setModelUsed('Institutional Decision Engine');
        setLastGenerated(localSetup);
        if (localSetup.signal !== 'NO_TRADE') onSetupGenerated(localSetup);
        soundFx.playSignalAlert();
      }
    } catch {
      // Network/server failure: fall back to the same local, validated computation.
      setModelUsed('Institutional Decision Engine (Offline Fallback)');
      setLastGenerated(localSetup);
      if (localSetup.signal !== 'NO_TRADE') onSetupGenerated(localSetup);
      soundFx.playSignalAlert();
    } finally {
      setIsGenerating(false);
    }
  };

  const setup = lastGenerated ?? activeSetup;
  const isNoTrade = setup?.signal === 'NO_TRADE';

  return (
    <div className="flex flex-col bg-[#0b0e14] border border-slate-800 rounded-lg overflow-hidden select-none">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5 bg-[#0d121c]">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
            <Sparkles className="h-3.5 w-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
              <span>SMC / ICT QUANT SETUP ENGINE</span>
              <span className="text-[10px] text-amber-400 font-normal">[{symbol}]</span>
            </h3>
            <div className="text-[10px] text-slate-400">
              Auto-detects Order Blocks, Fair Value Gaps, Liquidity Sweeps & CVD Divergence
            </div>
          </div>
        </div>

        <button
          id="generate-setup-btn"
          onClick={handleGenerateTrade}
          disabled={isGenerating}
          className="flex items-center gap-1.5 rounded bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-50 text-slate-950 px-3 py-1.5 font-mono text-xs font-bold transition-all shadow-md shadow-amber-500/20 cursor-pointer"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>SYNTHESIZING CONFLUENCES...</span>
            </>
          ) : (
            <>
              <Cpu className="h-3.5 w-3.5" />
              <span>GENERATE A+ SETUP</span>
            </>
          )}
        </button>
      </div>

      {/* Setup Body */}
      <div className="p-4 space-y-4">
        {setup ? (
          <div className="space-y-4">
            {/* Top Setup Banner */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-[#0e1420] border border-slate-800">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-extrabold ${
                    isNoTrade
                      ? 'bg-slate-700/30 text-slate-300 border border-slate-600/50'
                      : setup.signal.includes('BUY')
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-950'
                  }`}
                >
                  {isNoTrade ? (
                    <MinusCircle className="h-4 w-4 text-slate-400" />
                  ) : setup.signal.includes('BUY') ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-rose-400" />
                  )}
                  {isNoTrade ? 'NO TRADE' : setup.signal}
                </span>

                <div>
                  <h4 className="text-xs font-bold text-slate-100">{setup.setupName}</h4>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-2">
                    <span>Generated: {setup.timestamp || 'Live'}</span>
                    <span>•</span>
                    <span className="text-cyan-400">TF: {timeframe}</span>
                    {modelUsed && (
                      <>
                        <span>•</span>
                        <span className="text-amber-400/90">{modelUsed}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Confluence & Win Rate Badges */}
              <div className="flex items-center gap-2 font-mono">
                <div className="text-right">
                  <div className="text-[9px] text-slate-500 uppercase font-semibold">CONFLUENCE</div>
                  <div className="text-xs font-extrabold text-amber-400">
                    {setup.confluenceScore}/100
                  </div>
                </div>
                <div className="border-l border-slate-800 pl-2 text-right">
                  <div className="text-[9px] text-slate-500 uppercase font-semibold">HISTORICAL PROB</div>
                  <div className="text-xs font-extrabold text-emerald-400">
                    {safeFixed(setup.winProbability, 1)}%
                  </div>
                </div>
                <div className="border-l border-slate-800 pl-2 text-right">
                  <div className="text-[9px] text-slate-500 uppercase font-semibold">R:R RATIO</div>
                  <div className="text-xs font-extrabold text-cyan-400">
                    {setup.riskRewardRatio}
                  </div>
                </div>
              </div>
            </div>

            {/* Price Target Execution Matrix */}
            {isNoTrade ? (
              <div className="p-3 rounded-lg bg-[#0e1420] border border-slate-800 font-mono text-xs text-slate-400 flex items-center gap-2">
                <MinusCircle className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>
                  Confluence is {setup.confluenceScore}% — below the {CONFLUENCE_THRESHOLD}% institutional threshold required to publish an entry/stop/target grid. Standing aside.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div className="p-2.5 rounded-lg bg-[#0e1420] border border-slate-800 font-mono">
                  <div className="text-[9px] text-slate-400 uppercase font-semibold">ENTRY LIMIT</div>
                  <div className="text-sm font-bold text-slate-100 mt-0.5">
                    ${safeFixed(setup.entryPrice, symbol === 'BTC/USD' ? 1 : 2)}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5">Optimal Entry (OTE)</div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0e1420] border border-rose-950/60 font-mono">
                  <div className="text-[9px] text-rose-400 uppercase font-semibold flex items-center gap-1">
                    <ShieldAlert className="h-2.5 w-2.5" />
                    <span>STOP LOSS</span>
                  </div>
                  <div className="text-sm font-bold text-rose-300 mt-0.5">
                    ${safeFixed(setup.stopLoss, symbol === 'BTC/USD' ? 1 : 2)}
                  </div>
                  <div className="text-[9px] text-rose-500/80 mt-0.5">
                    Risk: ${safeFixed(Math.abs(setup.entryPrice - setup.stopLoss), 1)} pts
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0e1420] border border-emerald-950/60 font-mono">
                  <div className="text-[9px] text-emerald-400 uppercase font-semibold flex items-center gap-1">
                    <Target className="h-2.5 w-2.5" />
                    <span>TAKE PROFIT 1</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-300 mt-0.5">
                    ${safeFixed(setup.takeProfit1, symbol === 'BTC/USD' ? 1 : 2)}
                  </div>
                  <div className="text-[9px] text-emerald-500/80 mt-0.5">Scale 40% (1:1.8)</div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0e1420] border border-emerald-950/60 font-mono">
                  <div className="text-[9px] text-emerald-400 uppercase font-semibold flex items-center gap-1">
                    <Target className="h-2.5 w-2.5" />
                    <span>TAKE PROFIT 2</span>
                  </div>
                  <div className="text-sm font-bold text-emerald-300 mt-0.5">
                    ${safeFixed(setup.takeProfit2, symbol === 'BTC/USD' ? 1 : 2)}
                  </div>
                  <div className="text-[9px] text-emerald-500/80 mt-0.5">Scale 35% (1:3.4)</div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#0e1420] border border-cyan-950/60 font-mono col-span-2 sm:col-span-1">
                  <div className="text-[9px] text-cyan-400 uppercase font-semibold flex items-center gap-1">
                    <Target className="h-2.5 w-2.5" />
                    <span>TP3 (RUNNER)</span>
                  </div>
                  <div className="text-sm font-bold text-cyan-300 mt-0.5">
                    ${safeFixed(setup.takeProfit3, symbol === 'BTC/USD' ? 1 : 2)}
                  </div>
                  <div className="text-[9px] text-cyan-500/80 mt-0.5">Runner 25% (1:5.2)</div>
                </div>
              </div>
            )}

            {/* SMC & Liquidity Rationale Box */}
            <div className="p-3 rounded-lg bg-[#090d14] border border-slate-800 text-xs space-y-2">
              <div className="font-mono text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-amber-400" />
                <span>INSTITUTIONAL LIQUIDITY & SMART MONEY LOGIC</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed font-sans">
                {setup.smcRationale}
              </p>

              {/* Bullet Confluences */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                {setup.keyConfluences?.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-[11px] text-slate-300 font-mono">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Invalidation & Execution Rules */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-[10px] font-mono text-slate-400">
                <div className="flex items-center gap-1.5 text-rose-400">
                  <ShieldAlert className="h-3 w-3" />
                  <span>INVALIDATION: {setup.invalidationRule}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-300">
                  <Scale className="h-3 w-3 text-cyan-400" />
                  <span>REC. POSITION: {setup.recommendedSize} {symbol === 'BTC/USD' ? 'BTC' : 'Lots (150 oz)'} (Risk $1,000 USD)</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                id="apply-to-desk-btn"
                disabled={isNoTrade}
                onClick={() => {
                  if (isNoTrade) return;
                  onApplySetupToOrderDesk(setup);
                  soundFx.playClick();
                }}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 font-mono text-xs font-extrabold transition-all shadow-md active:scale-95 ${
                  isNoTrade
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20 cursor-pointer'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                <span>{isNoTrade ? 'NO VALID TRADE TO LOAD' : 'LOAD BRACKET ORDER TO EXECUTION DESK'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-slate-500 font-mono text-xs space-y-2">
            <Cpu className="h-8 w-8 mx-auto text-slate-700 animate-pulse" />
            <div>No active setup computed for {symbol}.</div>
            <div className="text-[11px] text-slate-600 max-w-md mx-auto">
              Click &quot;GENERATE A+ SETUP&quot; to synthesize institutional Smart Money Concepts, Order Blocks, Fair Value Gaps, and Volume Profile nodes.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
