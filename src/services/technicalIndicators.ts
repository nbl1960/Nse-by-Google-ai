import { Candle, FVGZone, OrderBlock, LiquidityLevel, CPRData } from '../types/trading';

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(candles: Candle[], period: number): (number | null)[] {
  if (candles.length < period) return new Array(candles.length).fill(null);

  const k = 2 / (period + 1);
  const emaArray: (number | null)[] = new Array(candles.length).fill(null);

  // Initial SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let prevEma = sum / period;
  emaArray[period - 1] = prevEma;

  for (let i = period; i < candles.length; i++) {
    prevEma = candles[i].close * k + prevEma * (1 - k);
    emaArray[i] = prevEma;
  }

  return emaArray;
}

/**
 * Calculates Intraday VWAP and +1 / -1 / +2 / -2 Standard Deviation bands
 */
export function calculateVWAP(candles: Candle[]): {
  vwap: (number | null)[];
  upperBand: (number | null)[];
  lowerBand: (number | null)[];
} {
  const vwapArr: (number | null)[] = [];
  const upperBandArr: (number | null)[] = [];
  const lowerBandArr: (number | null)[] = [];

  let cumulativeTypicalVol = 0;
  let cumulativeVol = 0;
  let cumulativeSquaredDiffVol = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume || 1;

    cumulativeTypicalVol += typicalPrice * vol;
    cumulativeVol += vol;

    const currentVwap = cumulativeTypicalVol / cumulativeVol;
    vwapArr.push(currentVwap);

    cumulativeSquaredDiffVol += Math.pow(typicalPrice - currentVwap, 2) * vol;
    const variance = cumulativeSquaredDiffVol / cumulativeVol;
    const stdDev = Math.sqrt(Math.max(0, variance));

    upperBandArr.push(currentVwap + stdDev * 1.5);
    lowerBandArr.push(currentVwap - stdDev * 1.5);
  }

  return { vwap: vwapArr, upperBand: upperBandArr, lowerBand: lowerBandArr };
}

/**
 * Calculates Central Pivot Range (CPR) and Camarilla Pivots
 * Crucial institutional metric for Indian Intraday traders (NIFTY & BANKNIFTY)
 */
export function calculateCPR(candles: Candle[]): CPRData {
  if (candles.length < 5) {
    const lastPrice = candles[candles.length - 1]?.close || 25000;
    return {
      tc: lastPrice + 15,
      pivot: lastPrice,
      bc: lastPrice - 15,
      cprWidth: 30,
      rangeType: 'AVERAGE',
      virginCpr: false,
      pdh: lastPrice + 50,
      pdl: lastPrice - 50,
      camarilla: {
        h3: lastPrice + 25,
        h4: lastPrice + 55,
        l3: lastPrice - 25,
        l4: lastPrice - 55,
      },
    };
  }

  // Derive Previous Session High, Low, Close from the first half or previous segment of candles
  const halfLen = Math.floor(candles.length * 0.6);
  const prevSlice = candles.slice(0, halfLen);
  const currentSlice = candles.slice(halfLen);

  const prevHigh = Math.max(...prevSlice.map((c) => c.high));
  const prevLow = Math.min(...prevSlice.map((c) => c.low));
  const prevClose = prevSlice[prevSlice.length - 1].close;

  // Standard CPR Formula
  // Pivot (P) = (High + Low + Close) / 3
  // Bottom Central (BC) = (High + Low) / 2
  // Top Central (TC) = (Pivot - BC) + Pivot
  const pivot = (prevHigh + prevLow + prevClose) / 3;
  const bc = (prevHigh + prevLow) / 2;
  const tc = pivot - bc + pivot;

  const top = Math.max(tc, bc);
  const bottom = Math.min(tc, bc);
  const cprWidth = top - bottom;
  const widthPercentage = (cprWidth / pivot) * 100;

  let rangeType: 'NARROW' | 'AVERAGE' | 'WIDE' = 'AVERAGE';
  if (widthPercentage < 0.12) rangeType = 'NARROW';
  else if (widthPercentage > 0.35) rangeType = 'WIDE';

  // Check if current day price has touched the CPR (Virgin CPR test)
  let touchedCPR = false;
  for (const c of currentSlice) {
    if (c.high >= bottom && c.low <= top) {
      touchedCPR = true;
      break;
    }
  }

  // Camarilla Equations
  // H4 = Close + Range * 1.1 / 2
  // H3 = Close + Range * 1.1 / 4
  // L3 = Close - Range * 1.1 / 4
  // L4 = Close - Range * 1.1 / 2
  const range = prevHigh - prevLow;
  const h4 = prevClose + (range * 1.1) / 2;
  const h3 = prevClose + (range * 1.1) / 4;
  const l3 = prevClose - (range * 1.1) / 4;
  const l4 = prevClose - (range * 1.1) / 2;

  return {
    tc: Number(tc.toFixed(2)),
    pivot: Number(pivot.toFixed(2)),
    bc: Number(bc.toFixed(2)),
    cprWidth: Number(cprWidth.toFixed(2)),
    rangeType,
    virginCpr: !touchedCPR,
    pdh: Number(prevHigh.toFixed(2)),
    pdl: Number(prevLow.toFixed(2)),
    camarilla: {
      h3: Number(h3.toFixed(2)),
      h4: Number(h4.toFixed(2)),
      l3: Number(l3.toFixed(2)),
      l4: Number(l4.toFixed(2)),
    },
  };
}

/**
 * Calculates RSI (Relative Strength Index)
 */
export function calculateRSI(candles: Candle[], period: number = 14): (number | null)[] {
  if (candles.length <= period) return new Array(candles.length).fill(null);

  const rsiValues: (number | null)[] = new Array(candles.length).fill(null);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiValues[period] = 100 - 100 / (1 + rs);

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const currentRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiValues[i] = 100 - 100 / (1 + currentRs);
  }

  return rsiValues;
}

/**
 * Detects Fair Value Gaps (FVG)
 */
export function detectFairValueGaps(candles: Candle[]): FVGZone[] {
  if (candles.length < 3) return [];
  const fvgs: FVGZone[] = [];

  for (let i = 0; i < candles.length - 2; i++) {
    const first = candles[i];
    const third = candles[i + 2];

    // Bullish FVG
    if (third.low > first.high) {
      const gapSize = third.low - first.high;
      const minThreshold = first.high * 0.0003;
      if (gapSize >= minThreshold) {
        let mitigated = false;
        for (let j = i + 3; j < candles.length; j++) {
          if (candles[j].low <= first.high) {
            mitigated = true;
            break;
          }
        }
        fvgs.push({
          type: 'bullish',
          top: third.low,
          bottom: first.high,
          startIndex: i + 1,
          mitigated,
        });
      }
    }

    // Bearish FVG
    if (third.high < first.low) {
      const gapSize = first.low - third.high;
      const minThreshold = third.high * 0.0003;
      if (gapSize >= minThreshold) {
        let mitigated = false;
        for (let j = i + 3; j < candles.length; j++) {
          if (candles[j].high >= first.low) {
            mitigated = true;
            break;
          }
        }
        fvgs.push({
          type: 'bearish',
          top: first.low,
          bottom: third.high,
          startIndex: i + 1,
          mitigated,
        });
      }
    }
  }

  return fvgs.slice(-8);
}

/**
 * Detects Bullish and Bearish Order Blocks (OB)
 */
export function detectOrderBlocks(candles: Candle[]): OrderBlock[] {
  if (candles.length < 5) return [];
  const blocks: OrderBlock[] = [];

  for (let i = 2; i < candles.length - 2; i++) {
    const current = candles[i];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    const isBearishCandle = current.close < current.open;
    const strongBullishImpulse = next1.close > next1.open && next2.close > next2.open && next2.close > current.high;

    if (isBearishCandle && strongBullishImpulse) {
      let mitigated = false;
      for (let k = i + 3; k < candles.length; k++) {
        if (candles[k].low <= current.low) {
          mitigated = true;
          break;
        }
      }
      blocks.push({
        type: 'bullish',
        high: current.high,
        low: current.low,
        startIndex: i,
        status: mitigated ? 'mitigated' : 'fresh',
      });
    }

    const isBullishCandle = current.close > current.open;
    const strongBearishImpulse = next1.close < next1.open && next2.close < next2.open && next2.close < current.low;

    if (isBullishCandle && strongBearishImpulse) {
      let mitigated = false;
      for (let k = i + 3; k < candles.length; k++) {
        if (candles[k].high >= current.high) {
          mitigated = true;
          break;
        }
      }
      blocks.push({
        type: 'bearish',
        high: current.high,
        low: current.low,
        startIndex: i,
        status: mitigated ? 'mitigated' : 'fresh',
      });
    }
  }

  return blocks.slice(-6);
}

/**
 * Identifies Buy-Side Liquidity (BSL) and Sell-Side Liquidity (SSL) swings
 */
export function detectLiquidityLevels(candles: Candle[]): LiquidityLevel[] {
  if (candles.length < 15) return [];
  const levels: LiquidityLevel[] = [];

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const currentPrice = candles[candles.length - 1].close;

  const highest = Math.max(...highs.slice(-30));
  const lowest = Math.min(...lows.slice(-30));

  levels.push({
    type: 'BSL',
    price: highest,
    label: 'BSL (Equal Highs / Buy Stops)',
    swept: currentPrice >= highest,
  });

  levels.push({
    type: 'SSL',
    price: lowest,
    label: 'SSL (Equal Lows / Sell Stops)',
    swept: currentPrice <= lowest,
  });

  return levels;
}
