import {
  AssetSymbol,
  Candle,
  ConfluenceFactor,
  InstitutionalSetup,
  Timeframe,
} from '../types/trading';
import {
  calculateCVD,
  calculateEMA,
  calculateMarketStructure,
  calculateVWAP,
  detectFairValueGaps,
  detectLiquidityLevels,
  detectOrderBlocks,
} from './technicalIndicators';

/**
 * NBL Trading Desk Decision Engine
 *
 * Critical signal rule: a directional BUY/SELL call is only ever produced when
 * the validated confluence score is >= CONFLUENCE_THRESHOLD. Anything below
 * that resolves to NO_TRADE — never a "weak"/"rejected"/"almost" signal.
 */
export const CONFLUENCE_THRESHOLD = 90;

/** Minimum real (structure-derived) risk-to-reward required before a trade can
 * be actionable — matches the project's own previously-stated institutional
 * minimum (1:2.5). Not a cosmetic number: see the risk-reward block below. */
export const MIN_RISK_REWARD = 2.5;

export type Direction = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface DecisionEngineContext {
  dxyChangePercent?: number;
  us10yChangePercent?: number;
  putCallRatio?: number;
}

export interface ConfluenceEvaluation {
  score: number; // 0-100, weight of the dominant direction
  direction: Direction;
  bullishWeight: number;
  bearishWeight: number;
  riskRewardOk: boolean;
  riskRewardRatio: number;
  factors: ConfluenceFactor[];
  levels: {
    entryPrice: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    takeProfit3: number;
  };
}

/** Mirrors the deterministic Deribit/CME-style OI model shown in OptionChainViewer,
 * so the options factor here always agrees with what the Derivatives tab displays. */
function computePutCallRatio(currentPrice: number, symbol: AssetSymbol): number {
  const isBtc = symbol === 'BTC/USD';
  const range = isBtc ? 5 : 4;
  let totalCallOi = 0;
  let totalPutOi = 0;
  for (let i = -range; i <= range; i++) {
    const callOi = (Math.sin(i * 0.8 + 1.2) * 450 + 650) * (isBtc ? 1.5 : 8);
    const putOi = (Math.cos(i * 0.7 + 1.4) * 420 + 600) * (isBtc ? 1.4 : 7.5);
    totalCallOi += callOi;
    totalPutOi += putOi;
  }
  return totalCallOi > 0 ? Number((totalPutOi / totalCallOi).toFixed(2)) : 1.0;
}

/** Shared "cannot evaluate" result shape — used whenever required market
 * context (candle history or a sane current price) is invalid, per the rule
 * that invalid/unavailable market context must resolve to NO_TRADE, never a
 * guessed or carried-over signal. */
function insufficientContextResult(fallbackPrice: number, reason: string): ConfluenceEvaluation {
  const factors: ConfluenceFactor[] = [];
  addFactor(factors, 'SMC', 'Market Structure', 'NEUTRAL', 18, 'Insufficient Data', reason);
  return {
    score: 0,
    direction: 'NEUTRAL',
    bullishWeight: 0,
    bearishWeight: 0,
    riskRewardOk: false,
    riskRewardRatio: 0,
    factors,
    levels: { entryPrice: fallbackPrice, stopLoss: fallbackPrice, takeProfit1: fallbackPrice, takeProfit2: fallbackPrice, takeProfit3: fallbackPrice },
  };
}

function addFactor(
  factors: ConfluenceFactor[],
  category: ConfluenceFactor['category'],
  name: string,
  status: 'BULLISH' | 'BEARISH' | 'NEUTRAL',
  weight: number,
  value: string,
  detail: string
) {
  factors.push({ category, name, status, weight, score: weight, value, detail });
}

/**
 * Evaluates every institutional confluence dimension from live candle data and
 * returns a weighted 0-100 score for the dominant direction. This is the single
 * source of truth consumed by the Confluence Matrix and the Setup Generator.
 */
export function evaluateConfluence(
  candles: Candle[],
  symbol: AssetSymbol,
  timeframe: Timeframe = '5m',
  context: DecisionEngineContext = {}
): ConfluenceEvaluation {
  if (candles.length < 20) {
    // Not enough live data to validate anything institutional-grade.
    const p = candles[candles.length - 1]?.close || 0;
    return insufficientContextResult(p, 'Awaiting sufficient candle history to compute structure.');
  }

  const currentPrice = candles[candles.length - 1].close;

  // Required market context validity check: a non-finite or non-positive
  // price means the feed is broken — never score against garbage data.
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return insufficientContextResult(0, 'Current price is invalid or unavailable — market context cannot be validated.');
  }

  const factors: ConfluenceFactor[] = [];
  const isGold = symbol === 'XAU/USD';

  const structure = calculateMarketStructure(candles);
  const orderBlocks = detectOrderBlocks(candles, timeframe);
  const fvgs = detectFairValueGaps(candles, timeframe);
  const liquidity = detectLiquidityLevels(candles);
  const vwapData = calculateVWAP(candles);
  const ema9 = calculateEMA(candles, 9);
  const ema21 = calculateEMA(candles, 21);
  const ema50 = calculateEMA(candles, 50);
  const cvd = calculateCVD(candles);

  // 1. SMC Market Structure — BOS / CHoCH (weight 18)
  {
    let status: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let value = 'No confirmed structure shift';
    if (structure.lastShift === 'BOS') {
      status = 'BULLISH';
      value = `Bullish BOS above $${structure.shiftPrice?.toFixed(2)}`;
    } else if (structure.lastShift === 'MSS') {
      status = 'BEARISH';
      value = `Bearish CHoCH below $${structure.shiftPrice?.toFixed(2)}`;
    } else if (structure.trend !== 'RANGING') {
      status = structure.trend === 'BULLISH' ? 'BULLISH' : 'BEARISH';
      value = `${structure.trend} trend, no fresh break of structure`;
    }
    addFactor(
      factors,
      'SMC',
      'Market Structure (BOS/CHoCH)',
      status,
      18,
      value,
      `Range $${structure.swingLow.toFixed(2)}–$${structure.swingHigh.toFixed(2)}, price in ${structure.premiumDiscount.replace('_', ' ').toLowerCase()}.`
    );
  }

  // 2. Order Blocks (weight 12)
  {
    const activeOb = [...orderBlocks].reverse().find((ob) => ob.status !== 'mitigated');
    let status: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let value = 'No unmitigated order block in range';
    if (activeOb) {
      status = activeOb.type === 'bullish' ? 'BULLISH' : 'BEARISH';
      value = `${activeOb.status.toUpperCase()} ${activeOb.type} OB $${activeOb.low.toFixed(2)}–$${activeOb.high.toFixed(2)}`;
    }
    addFactor(factors, 'SMC', 'Order Blocks', status, 12, value, 'Institutional displacement origin zone, most recent unmitigated block.');
  }

  // 3. Fair Value Gaps (weight 10)
  {
    const activeFvg = [...fvgs].reverse().find((f) => f.status !== 'mitigated');
    let status: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    let value = 'No open imbalance nearby';
    if (activeFvg) {
      status = activeFvg.type === 'bullish' ? 'BULLISH' : 'BEARISH';
      value = `${activeFvg.status.toUpperCase()} ${activeFvg.type} FVG $${activeFvg.bottom.toFixed(2)}–$${activeFvg.top.toFixed(2)}`;
    }
    addFactor(factors, 'SMC', 'Fair Value Gaps', status, 10, value, 'Unfilled 3-candle imbalance acting as a magnet for price.');
  }

  // 4. Liquidity Sweeps (weight 15)
  {
    const bullishSweeps = liquidity.filter((l) => l.swept && (l.type === 'SSL' || l.type === 'PDL' || l.type === 'ASL')).length;
    const bearishSweeps = liquidity.filter((l) => l.swept && (l.type === 'BSL' || l.type === 'PDH' || l.type === 'ASH')).length;
    let status: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (bullishSweeps > bearishSweeps) status = 'BULLISH';
    else if (bearishSweeps > bullishSweeps) status = 'BEARISH';
    addFactor(
      factors,
      'SMC',
      'Liquidity Sweeps',
      status,
      15,
      `${bullishSweeps} sell-side vs ${bearishSweeps} buy-side pools swept`,
      'Sell-side liquidity sweeps favor bullish reversal; buy-side sweeps favor bearish reversal.'
    );
  }

  // 5. VWAP & EMA Alignment (weight 15)
  {
    const lastVwap = vwapData.vwap[vwapData.vwap.length - 1] ?? currentPrice;
    const e9 = ema9[ema9.length - 1];
    const e21 = ema21[ema21.length - 1];
    const e50 = ema50[ema50.length - 1];

    let bullVotes = 0;
    let bearVotes = 0;
    if (currentPrice > lastVwap) bullVotes++; else bearVotes++;
    if (e9 !== null && e21 !== null) { if (e9 > e21) bullVotes++; else bearVotes++; }
    if (e21 !== null && e50 !== null) { if (e21 > e50) bullVotes++; else bearVotes++; }

    const status: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = bullVotes >= 2 ? 'BULLISH' : bearVotes >= 2 ? 'BEARISH' : 'NEUTRAL';
    addFactor(
      factors,
      'ORDER_FLOW',
      'VWAP & EMA Trend Alignment',
      status,
      15,
      `Price ${currentPrice > lastVwap ? 'above' : 'below'} VWAP $${lastVwap.toFixed(2)}`,
      `EMA9/21/50 stack: ${e9?.toFixed(2) ?? '--'} / ${e21?.toFixed(2) ?? '--'} / ${e50?.toFixed(2) ?? '--'}`
    );
  }

  // 6. CVD / Order Flow (weight 10)
  {
    let status: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (cvd.divergenceAlert === 'BULLISH_ABSORPTION' || cvd.buyRatio > 0.55) status = 'BULLISH';
    else if (cvd.divergenceAlert === 'BEARISH_EXHAUSTION' || cvd.buyRatio < 0.45) status = 'BEARISH';
    addFactor(
      factors,
      'ORDER_FLOW',
      'Cumulative Volume Delta',
      status,
      10,
      `${cvd.cumulativeDelta >= 0 ? '+' : ''}${cvd.cumulativeDelta} Delta (${cvd.divergenceAlert.replace('_', ' ')})`,
      `Buy ratio ${(cvd.buyRatio * 100).toFixed(0)}% of recent tape. Proxy metric: estimated from candle wick/body geometry, not raw executed order-flow.`
    );
  }

  // 7. Macro / Intermarket — DXY & Real Yields (weight 10)
  {
    const dxyChange = context.dxyChangePercent ?? 0;
    const us10yChange = context.us10yChangePercent ?? 0;
    let bias = -dxyChange; // inverse correlation for both BTC & Gold
    if (isGold) bias += -us10yChange * 0.5; // rising real yields are a headwind for gold
    let status: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (bias > 0.05) status = 'BULLISH';
    else if (bias < -0.05) status = 'BEARISH';
    addFactor(
      factors,
      'MACRO_INTERMARKET',
      'DXY & Intermarket Correlation',
      status,
      10,
      `DXY ${dxyChange >= 0 ? '+' : ''}${dxyChange.toFixed(2)}%${isGold ? `, US10Y ${us10yChange >= 0 ? '+' : ''}${us10yChange.toFixed(2)}%` : ''}`,
      'Dollar Index and real yields inversely dictate BTC & Gold risk appetite. Static/illustrative: /api/market/macro currently serves fixed figures, not a live macro feed.'
    );
  }

  // 8. Options Positioning — Put/Call Ratio (weight 10)
  {
    const pcr = context.putCallRatio ?? computePutCallRatio(currentPrice, symbol);
    let status: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
    if (pcr < 0.92) status = 'BULLISH';
    else if (pcr > 1.08) status = 'BEARISH';
    addFactor(
      factors,
      'MACRO_INTERMARKET',
      'Options Put/Call Ratio',
      status,
      10,
      `PCR ${pcr.toFixed(2)}`,
      'Call-heavy positioning skews bullish; put-heavy hedging skews bearish. Synthetic: PCR is a deterministic illustrative model, not live options-market open interest.'
    );
  }

  const bullishWeight = factors.filter((f) => f.status === 'BULLISH').reduce((acc, f) => acc + (f.weight || 0), 0);
  const bearishWeight = factors.filter((f) => f.status === 'BEARISH').reduce((acc, f) => acc + (f.weight || 0), 0);

  let direction: Direction = 'NEUTRAL';
  if (bullishWeight > bearishWeight) direction = 'BULLISH';
  else if (bearishWeight > bullishWeight) direction = 'BEARISH';

  const score = Math.round(direction === 'NEUTRAL' ? Math.max(bullishWeight, bearishWeight) : (direction === 'BULLISH' ? bullishWeight : bearishWeight));

  // Risk validation: derive the stop AND the target from real structural
  // levels (the analyzed range's opposite swing extreme), then compute the
  // ACTUAL achievable risk-to-reward from those two real distances. This is
  // a real gate, not a formality — riskRewardOk only becomes true when the
  // measured ratio clears MIN_RISK_REWARD. TP1/TP2/TP3 remain risk-multiple
  // projections for display/compatibility (see buildInstitutionalSetup),
  // NOT independently structurally validated targets — only riskRewardRatio
  // below reflects the real, structure-derived achievable ratio.
  const entryPrice = currentPrice;
  let stopLoss = entryPrice;
  let takeProfit1 = entryPrice;
  let takeProfit2 = entryPrice;
  let takeProfit3 = entryPrice;
  let riskRewardRatio = 0;
  let riskRewardOk = false;

  if (direction === 'BULLISH') {
    const protectiveLevel = Math.min(structure.swingLow, entryPrice * 0.997);
    const targetLevel = structure.swingHigh; // real structural target: analyzed range high
    const riskDistance = entryPrice - protectiveLevel;
    const rewardDistance = targetLevel - entryPrice;
    if (riskDistance > 0 && rewardDistance > 0) {
      const achievableRR = rewardDistance / riskDistance;
      stopLoss = Number(protectiveLevel.toFixed(2));
      takeProfit1 = Number((entryPrice + riskDistance * 1.8).toFixed(2));
      takeProfit2 = Number((entryPrice + riskDistance * 3.0).toFixed(2));
      takeProfit3 = Number((entryPrice + riskDistance * 4.5).toFixed(2));
      riskRewardRatio = Number(achievableRR.toFixed(2));
      riskRewardOk = achievableRR >= MIN_RISK_REWARD;
    }
  } else if (direction === 'BEARISH') {
    const protectiveLevel = Math.max(structure.swingHigh, entryPrice * 1.003);
    const targetLevel = structure.swingLow; // real structural target: analyzed range low
    const riskDistance = protectiveLevel - entryPrice;
    const rewardDistance = entryPrice - targetLevel;
    if (riskDistance > 0 && rewardDistance > 0) {
      const achievableRR = rewardDistance / riskDistance;
      stopLoss = Number(protectiveLevel.toFixed(2));
      takeProfit1 = Number((entryPrice - riskDistance * 1.8).toFixed(2));
      takeProfit2 = Number((entryPrice - riskDistance * 3.0).toFixed(2));
      takeProfit3 = Number((entryPrice - riskDistance * 4.5).toFixed(2));
      riskRewardRatio = Number(achievableRR.toFixed(2));
      riskRewardOk = achievableRR >= MIN_RISK_REWARD;
    }
  }

  return {
    score,
    direction,
    bullishWeight,
    bearishWeight,
    riskRewardOk,
    riskRewardRatio,
    factors,
    levels: { entryPrice, stopLoss, takeProfit1, takeProfit2, takeProfit3 },
  };
}

/**
 * Builds a full InstitutionalSetup from the confluence evaluation, strictly
 * enforcing the critical signal rule: BUY/SELL only at score >= CONFLUENCE_THRESHOLD
 * with a clear direction and valid risk; otherwise NO_TRADE.
 */
export function buildInstitutionalSetup(
  candles: Candle[],
  symbol: AssetSymbol,
  timeframe: Timeframe,
  context: DecisionEngineContext = {}
): InstitutionalSetup {
  const evaluation = evaluateConfluence(candles, symbol, timeframe, context);
  const { score, direction, riskRewardOk, levels, factors } = evaluation;
  const isActionable = score >= CONFLUENCE_THRESHOLD && direction !== 'NEUTRAL' && riskRewardOk;

  const bullishFactorNames = factors.filter((f) => f.status === 'BULLISH').map((f) => f.name);
  const bearishFactorNames = factors.filter((f) => f.status === 'BEARISH').map((f) => f.name);

  const timestamp = new Date().toLocaleTimeString();

  if (!isActionable) {
    const scoreBelowThreshold = score < CONFLUENCE_THRESHOLD;
    const reasons: string[] = [];
    if (scoreBelowThreshold) reasons.push(`confluence is ${score}%, below the ${CONFLUENCE_THRESHOLD}% institutional threshold`);
    if (direction === 'NEUTRAL') reasons.push('no clear directional bias');
    if (!riskRewardOk) {
      reasons.push(
        evaluation.riskRewardRatio > 0
          ? `achievable risk-to-reward is only 1:${evaluation.riskRewardRatio.toFixed(2)}, below the required 1:${MIN_RISK_REWARD} minimum`
          : 'no valid structural target could be established for a risk-to-reward calculation'
      );
    }
    const reasonText = reasons.join('; ');

    return {
      asset: symbol,
      signal: 'NO_TRADE',
      setupName: 'No Trade — Institutional Confluence Threshold Not Met',
      confluenceScore: score,
      heuristicConfidence: 0,
      riskRewardRatio: evaluation.riskRewardRatio > 0 ? `1:${evaluation.riskRewardRatio.toFixed(2)}` : 'N/A',
      entryPrice: levels.entryPrice,
      stopLoss: levels.entryPrice,
      takeProfit1: levels.entryPrice,
      takeProfit2: levels.entryPrice,
      takeProfit3: levels.entryPrice,
      recommendedSize: 0,
      riskAmountUsd: 0,
      smcThesis: `Standing aside: ${reasonText}.`,
      smcRationale: `Standing aside rather than forcing an entry: ${reasonText}.`,
      keyConfluences: (direction === 'BULLISH' ? bullishFactorNames : direction === 'BEARISH' ? bearishFactorNames : [...bullishFactorNames, ...bearishFactorNames]).slice(0, 4),
      invalidationRule: `No active trade — re-evaluate once confluence reaches ${CONFLUENCE_THRESHOLD}% with a valid ${MIN_RISK_REWARD}:1+ risk-to-reward.`,
      executionChecklist: [
        'Wait for additional confirming confluence',
        'Re-run the decision engine after the next structure shift',
        'Do not force entries below the institutional threshold',
      ],
      timestamp,
    };
  }

  const isGold = symbol === 'XAU/USD';
  const signal: InstitutionalSetup['signal'] = direction === 'BULLISH'
    ? (score >= 96 ? 'STRONG_BUY' : 'BUY')
    : (score >= 96 ? 'STRONG_SELL' : 'SELL');

  const rationaleFactors = direction === 'BULLISH' ? bullishFactorNames : bearishFactorNames;

  return {
    asset: symbol,
    signal,
    setupName: `${direction === 'BULLISH' ? 'Bullish' : 'Bearish'} ${symbol} Confluence Setup (${score}%)`,
    confluenceScore: score,
    // Heuristic display value only — NOT a statistically derived win probability.
    heuristicConfidence: Math.min(92, 55 + Math.round(score * 0.4)),
    riskRewardRatio: `1:${evaluation.riskRewardRatio.toFixed(2)}`,
    entryPrice: levels.entryPrice,
    stopLoss: levels.stopLoss,
    takeProfit1: levels.takeProfit1,
    takeProfit2: levels.takeProfit2,
    takeProfit3: levels.takeProfit3,
    recommendedSize: isGold ? 1.0 : 0.4,
    riskAmountUsd: 1000,
    smcThesis: `${rationaleFactors.join(', ')} align at ${score}% institutional confluence (score, not a win probability).`,
    smcRationale: `${rationaleFactors.join(', ')} align to produce a validated ${score}% confluence score, clearing the ${CONFLUENCE_THRESHOLD}% institutional threshold for a ${direction.toLowerCase()} bias with a real achievable risk-to-reward of 1:${evaluation.riskRewardRatio.toFixed(2)}. TP1/TP2/TP3 below are projected risk-multiples, not independently structurally validated targets.`,
    keyConfluences: rationaleFactors.slice(0, 4),
    invalidationRule: direction === 'BULLISH'
      ? `Close below $${levels.stopLoss.toFixed(2)} invalidates the bullish thesis.`
      : `Close above $${levels.stopLoss.toFixed(2)} invalidates the bearish thesis.`,
    executionChecklist: [
      'Confirm structure shift with volume displacement before firing',
      'Verify spread is within normal range before executing',
      'Scale partial profit at TP1 and move stop to breakeven',
      'TP1/TP2/TP3 are projected risk-multiples — treat as planning levels, not validated structural targets',
    ],
    timestamp,
  };
}
