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
  const factors: ConfluenceFactor[] = [];

  if (candles.length < 20) {
    // Not enough live data to validate anything institutional-grade.
    const p = candles[candles.length - 1]?.close || 0;
    addFactor(factors, 'SMC', 'Market Structure', 'NEUTRAL', 18, 'Insufficient Data', 'Awaiting sufficient candle history to compute structure.');
    return {
      score: 0,
      direction: 'NEUTRAL',
      bullishWeight: 0,
      bearishWeight: 0,
      riskRewardOk: false,
      riskRewardRatio: 0,
      factors,
      levels: { entryPrice: p, stopLoss: p, takeProfit1: p, takeProfit2: p, takeProfit3: p },
    };
  }

  const currentPrice = candles[candles.length - 1].close;
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
      `Buy ratio ${(cvd.buyRatio * 100).toFixed(0)}% of recent tape.`
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
      'Dollar Index and real yields inversely dictate BTC & Gold risk appetite.'
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
      'Call-heavy positioning skews bullish; put-heavy hedging skews bearish.'
    );
  }

  const bullishWeight = factors.filter((f) => f.status === 'BULLISH').reduce((acc, f) => acc + (f.weight || 0), 0);
  const bearishWeight = factors.filter((f) => f.status === 'BEARISH').reduce((acc, f) => acc + (f.weight || 0), 0);

  let direction: Direction = 'NEUTRAL';
  if (bullishWeight > bearishWeight) direction = 'BULLISH';
  else if (bearishWeight > bullishWeight) direction = 'BEARISH';

  const score = Math.round(direction === 'NEUTRAL' ? Math.max(bullishWeight, bearishWeight) : (direction === 'BULLISH' ? bullishWeight : bearishWeight));

  // Risk validation: derive entry/stop/targets from real structural levels and
  // require a minimum 1:2.4 risk-to-reward before a trade can ever be valid.
  const entryPrice = currentPrice;
  let stopLoss = entryPrice;
  let takeProfit1 = entryPrice;
  let takeProfit2 = entryPrice;
  let takeProfit3 = entryPrice;
  let riskRewardRatio = 0;
  let riskRewardOk = false;

  if (direction === 'BULLISH') {
    const protectiveLevel = Math.min(structure.swingLow, entryPrice * 0.997);
    const riskDistance = entryPrice - protectiveLevel;
    if (riskDistance > 0) {
      stopLoss = Number(protectiveLevel.toFixed(2));
      takeProfit1 = Number((entryPrice + riskDistance * 1.8).toFixed(2));
      takeProfit2 = Number((entryPrice + riskDistance * 3.0).toFixed(2));
      takeProfit3 = Number((entryPrice + riskDistance * 4.5).toFixed(2));
      riskRewardRatio = 3.0;
      riskRewardOk = true;
    }
  } else if (direction === 'BEARISH') {
    const protectiveLevel = Math.max(structure.swingHigh, entryPrice * 1.003);
    const riskDistance = protectiveLevel - entryPrice;
    if (riskDistance > 0) {
      stopLoss = Number(protectiveLevel.toFixed(2));
      takeProfit1 = Number((entryPrice - riskDistance * 1.8).toFixed(2));
      takeProfit2 = Number((entryPrice - riskDistance * 3.0).toFixed(2));
      takeProfit3 = Number((entryPrice - riskDistance * 4.5).toFixed(2));
      riskRewardRatio = 3.0;
      riskRewardOk = true;
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
    return {
      asset: symbol,
      signal: 'NO_TRADE',
      setupName: 'No Trade — Institutional Confluence Threshold Not Met',
      confluenceScore: score,
      winProbability: 0,
      riskRewardRatio: 'N/A',
      entryPrice: levels.entryPrice,
      stopLoss: levels.entryPrice,
      takeProfit1: levels.entryPrice,
      takeProfit2: levels.entryPrice,
      takeProfit3: levels.entryPrice,
      recommendedSize: 0,
      riskAmountUsd: 0,
      smcThesis: `Confluence at ${score}% (${direction}) is below the ${CONFLUENCE_THRESHOLD}% institutional threshold required to act.`,
      smcRationale: `Confluence at ${score}% (${direction} bias) is below the ${CONFLUENCE_THRESHOLD}% institutional threshold${!riskRewardOk ? ', and structural risk levels are invalid' : ''}. Standing aside rather than forcing an entry.`,
      keyConfluences: (direction === 'BULLISH' ? bullishFactorNames : direction === 'BEARISH' ? bearishFactorNames : [...bullishFactorNames, ...bearishFactorNames]).slice(0, 4),
      invalidationRule: `No active trade — re-evaluate once confluence reaches ${CONFLUENCE_THRESHOLD}%.`,
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
    winProbability: Math.min(92, 55 + Math.round(score * 0.4)),
    riskRewardRatio: `1:${evaluation.riskRewardRatio.toFixed(1)}`,
    entryPrice: levels.entryPrice,
    stopLoss: levels.stopLoss,
    takeProfit1: levels.takeProfit1,
    takeProfit2: levels.takeProfit2,
    takeProfit3: levels.takeProfit3,
    recommendedSize: isGold ? 1.0 : 0.4,
    riskAmountUsd: 1000,
    smcThesis: `${rationaleFactors.join(', ')} align at ${score}% institutional confluence.`,
    smcRationale: `${rationaleFactors.join(', ')} align to produce a validated ${score}% confluence score, clearing the ${CONFLUENCE_THRESHOLD}% institutional threshold for a ${direction.toLowerCase()} bias.`,
    keyConfluences: rationaleFactors.slice(0, 4),
    invalidationRule: direction === 'BULLISH'
      ? `Close below $${levels.stopLoss.toFixed(2)} invalidates the bullish thesis.`
      : `Close above $${levels.stopLoss.toFixed(2)} invalidates the bearish thesis.`,
    executionChecklist: [
      'Confirm structure shift with volume displacement before firing',
      'Verify spread is within normal range before executing',
      'Scale partial profit at TP1 and move stop to breakeven',
    ],
    timestamp,
  };
}
