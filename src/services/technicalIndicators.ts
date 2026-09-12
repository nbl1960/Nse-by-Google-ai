import { 
  Candle, 
  OrderBlock, 
  FVGZone, 
  LiquidityLevel, 
  MarketStructure, 
  VolumeProfileData, 
  VolumeProfileNode, 
  CvdData, 
  KillzoneInfo, 
  Timeframe 
} from '../types/trading';

export interface CPRData {
  tc: number; // Top Central
  pivot: number; // Pivot Point
  bc: number; // Bottom Central
  cprWidth: number; // |tc - bc|
  rangeType: 'NARROW' | 'AVERAGE' | 'WIDE';
  virginCpr: boolean;
  pdh: number; // Previous Day High
  pdl: number; // Previous Day Low
  camarilla: {
    h3: number;
    h4: number;
    l3: number;
    l4: number;
  };
}

/**
 * Calculates Central Pivot Range (CPR) & Camarilla Breakout Pivots
 */
export function calculateCPR(candles: Candle[]): CPRData {
  if (candles.length < 5) {
    const lastPrice = candles[candles.length - 1]?.close || 65000;
    return {
      tc: lastPrice + 50,
      pivot: lastPrice,
      bc: lastPrice - 50,
      cprWidth: 100,
      rangeType: 'AVERAGE',
      virginCpr: false,
      pdh: lastPrice + 120,
      pdl: lastPrice - 120,
      camarilla: {
        h3: lastPrice + 70,
        h4: lastPrice + 140,
        l3: lastPrice - 70,
        l4: lastPrice - 140,
      },
    };
  }

  const halfLen = Math.floor(candles.length * 0.6);
  const prevSlice = candles.slice(0, halfLen);
  const currentSlice = candles.slice(halfLen);

  const prevHigh = Math.max(...prevSlice.map((c) => c.high));
  const prevLow = Math.min(...prevSlice.map((c) => c.low));
  const prevClose = prevSlice[prevSlice.length - 1].close;

  const pivot = (prevHigh + prevLow + prevClose) / 3;
  const bc = (prevHigh + prevLow) / 2;
  const tc = 2 * pivot - bc;

  const sortedTc = Math.max(tc, bc);
  const sortedBc = Math.min(tc, bc);
  const cprWidth = Math.abs(sortedTc - sortedBc);
  const cprPercent = (cprWidth / pivot) * 100;

  let rangeType: 'NARROW' | 'AVERAGE' | 'WIDE' = 'AVERAGE';
  if (cprPercent < 0.18) rangeType = 'NARROW';
  else if (cprPercent > 0.45) rangeType = 'WIDE';

  // Virgin CPR Check
  let virginCpr = true;
  for (const c of currentSlice) {
    if (c.high >= sortedBc && c.low <= sortedTc) {
      virginCpr = false;
      break;
    }
  }

  // Camarilla Pivots
  const range = prevHigh - prevLow;
  const h4 = prevClose + range * 1.1 / 2;
  const h3 = prevClose + range * 1.1 / 4;
  const l3 = prevClose - range * 1.1 / 4;
  const l4 = prevClose - range * 1.1 / 2;

  return {
    tc: Number(sortedTc.toFixed(2)),
    pivot: Number(pivot.toFixed(2)),
    bc: Number(sortedBc.toFixed(2)),
    cprWidth: Number(cprWidth.toFixed(2)),
    rangeType,
    virginCpr,
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
 * Calculates Relative Strength Index (RSI)
 */
export function calculateRSI(candles: Candle[], period: number = 14): (number | null)[] {
  if (candles.length <= period) return new Array(candles.length).fill(null);

  const rsiArray: (number | null)[] = new Array(candles.length).fill(null);
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsiArray[period] = 100 - (100 / (1 + rs));

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const currentRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsiArray[i] = Number((100 - (100 / (1 + currentRs))).toFixed(2));
  }

  return rsiArray;
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEMA(candles: Candle[], period: number): (number | null)[] {
  if (candles.length < period) return new Array(candles.length).fill(null);

  const k = 2 / (period + 1);
  const emaArray: (number | null)[] = new Array(candles.length).fill(null);

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
 * Calculates Intraday VWAP and ±1.0, ±1.5, ±2.0 Standard Deviation bands
 */
export function calculateVWAP(candles: Candle[]): {
  vwap: (number | null)[];
  upperBand1: (number | null)[];
  lowerBand1: (number | null)[];
  upperBand2: (number | null)[];
  lowerBand2: (number | null)[];
} {
  const vwapArr: (number | null)[] = [];
  const upperBand1Arr: (number | null)[] = [];
  const lowerBand1Arr: (number | null)[] = [];
  const upperBand2Arr: (number | null)[] = [];
  const lowerBand2Arr: (number | null)[] = [];

  let cumulativeTypicalVol = 0;
  let cumulativeVol = 0;
  let cumulativeSquaredDiffVol = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = Math.max(1, c.volume || 1);

    cumulativeTypicalVol += typicalPrice * vol;
    cumulativeVol += vol;

    const currentVwap = cumulativeTypicalVol / cumulativeVol;
    vwapArr.push(currentVwap);

    cumulativeSquaredDiffVol += Math.pow(typicalPrice - currentVwap, 2) * vol;
    const variance = cumulativeSquaredDiffVol / cumulativeVol;
    const stdDev = Math.sqrt(Math.max(0, variance));

    upperBand1Arr.push(currentVwap + stdDev * 1.28); // 80% distribution
    lowerBand1Arr.push(currentVwap - stdDev * 1.28);
    upperBand2Arr.push(currentVwap + stdDev * 2.0);  // 95% extreme band
    lowerBand2Arr.push(currentVwap - stdDev * 2.0);
  }

  return { 
    vwap: vwapArr, 
    upperBand1: upperBand1Arr, 
    lowerBand1: lowerBand1Arr, 
    upperBand2: upperBand2Arr, 
    lowerBand2: lowerBand2Arr 
  };
}

/**
 * Detects Institutional Smart Money Concepts (SMC) Order Blocks (OB)
 * Bullish OB: Last down candle before strong upward displacement
 * Bearish OB: Last up candle before strong downward displacement
 */
export function detectOrderBlocks(candles: Candle[], timeframe: Timeframe = '5m'): OrderBlock[] {
  if (candles.length < 10) return [];
  const obs: OrderBlock[] = [];

  // Calculate average body size for displacement measurement
  let totalBody = 0;
  for (let i = 0; i < candles.length; i++) {
    totalBody += Math.abs(candles[i].close - candles[i].open);
  }
  const avgBody = totalBody / candles.length;

  for (let i = 2; i < candles.length - 2; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next1 = candles[i + 1];
    const next2 = candles[i + 2];

    const next1Displacement = Math.abs(next1.close - next1.open);
    const isStrongDisplacement = next1Displacement > avgBody * 1.4;

    // Bullish Order Block: Down candle followed by aggressive bullish displacement
    if (curr.close < curr.open && next1.close > next1.open && isStrongDisplacement) {
      if (next1.close > curr.high) {
        const high = Math.max(curr.high, curr.open);
        const low = curr.low;
        const meanThreshold = Number(((high + low) / 2).toFixed(2));

        // Check if subsequent candles have mitigated this zone
        let status: 'fresh' | 'tested' | 'mitigated' = 'fresh';
        for (let j = i + 2; j < candles.length; j++) {
          if (candles[j].low <= low) {
            status = 'mitigated';
            break;
          } else if (candles[j].low <= high) {
            status = 'tested';
          }
        }

        obs.push({
          type: 'bullish',
          high,
          low,
          meanThreshold,
          startIndex: i,
          status,
          volumeScore: Math.round(next1.volume / (avgBody || 1)),
          timeframe,
        });
      }
    }

    // Bearish Order Block: Up candle followed by aggressive bearish displacement
    if (curr.close > curr.open && next1.close < next1.open && isStrongDisplacement) {
      if (next1.close < curr.low) {
        const high = curr.high;
        const low = Math.min(curr.low, curr.open);
        const meanThreshold = Number(((high + low) / 2).toFixed(2));

        let status: 'fresh' | 'tested' | 'mitigated' = 'fresh';
        for (let j = i + 2; j < candles.length; j++) {
          if (candles[j].high >= high) {
            status = 'mitigated';
            break;
          } else if (candles[j].high >= low) {
            status = 'tested';
          }
        }

        obs.push({
          type: 'bearish',
          high,
          low,
          meanThreshold,
          startIndex: i,
          status,
          volumeScore: Math.round(next1.volume / (avgBody || 1)),
          timeframe,
        });
      }
    }
  }

  return obs.slice(-6); // Keep the most recent 6 order blocks
}

/**
 * Detects Fair Value Gaps (FVG) / Imbalances
 * 3-candle pattern where candle 1 and candle 3 wicks do not overlap
 */
export function detectFairValueGaps(candles: Candle[], timeframe: Timeframe = '5m'): FVGZone[] {
  if (candles.length < 5) return [];
  const fvgs: FVGZone[] = [];

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c3 = candles[i];

    // Bullish FVG (SIBI): c3 low > c1 high
    if (c3.low > c1.high) {
      const top = c3.low;
      const bottom = c1.high;
      const ce = Number(((top + bottom) / 2).toFixed(2)); // Consequent Encroachment (50%)

      // Check fill status
      let status: 'open' | 'partial' | 'mitigated' = 'open';
      let fillPercent = 0;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].low <= bottom) {
          status = 'mitigated';
          fillPercent = 100;
          break;
        } else if (candles[j].low <= ce) {
          status = 'partial';
          fillPercent = 50;
        }
      }

      fvgs.push({
        type: 'bullish',
        top,
        bottom,
        ce,
        startIndex: i - 1,
        status,
        fillPercent,
        timeframe,
      });
    }

    // Bearish FVG (BISI): c3 high < c1 low
    if (c3.high < c1.low) {
      const top = c1.low;
      const bottom = c3.high;
      const ce = Number(((top + bottom) / 2).toFixed(2));

      let status: 'open' | 'partial' | 'mitigated' = 'open';
      let fillPercent = 0;
      for (let j = i + 1; j < candles.length; j++) {
        if (candles[j].high >= top) {
          status = 'mitigated';
          fillPercent = 100;
          break;
        } else if (candles[j].high >= ce) {
          status = 'partial';
          fillPercent = 50;
        }
      }

      fvgs.push({
        type: 'bearish',
        top,
        bottom,
        ce,
        startIndex: i - 1,
        status,
        fillPercent,
        timeframe,
      });
    }
  }

  return fvgs.slice(-8); // Keep 8 most recent
}

/**
 * Detects Institutional Liquidity Levels & Sweeps
 * (BSL, SSL, PDH, PDL, Asian Range High/Low, Equal Highs/Lows)
 */
export function detectLiquidityLevels(candles: Candle[]): LiquidityLevel[] {
  if (candles.length < 20) return [];
  const levels: LiquidityLevel[] = [];
  const currentPrice = candles[candles.length - 1].close;

  // Previous Session High & Low (first 60% of candles representing prior trading segment)
  const priorSlice = candles.slice(0, Math.floor(candles.length * 0.65));
  const recentSlice = candles.slice(Math.floor(candles.length * 0.65));

  const pdh = Math.max(...priorSlice.map((c) => c.high));
  const pdl = Math.min(...priorSlice.map((c) => c.low));

  const pdhSwept = recentSlice.some((c) => c.high > pdh && c.close < pdh);
  const pdlSwept = recentSlice.some((c) => c.low < pdl && c.close > pdl);

  levels.push({
    type: 'PDH',
    price: pdh,
    label: 'PDH (Prev Day High Liquidity)',
    swept: pdhSwept,
  });

  levels.push({
    type: 'PDL',
    price: pdl,
    label: 'PDL (Prev Day Low Liquidity)',
    swept: pdlSwept,
  });

  // Asian Range High / Low (approximated from earlier intraday block)
  const asianSlice = candles.slice(0, Math.min(30, candles.length));
  const asianHigh = Math.max(...asianSlice.map((c) => c.high));
  const asianLow = Math.min(...asianSlice.map((c) => c.low));

  const asianHighSwept = candles.slice(30).some((c) => c.high > asianHigh && c.close < asianHigh);
  const asianLowSwept = candles.slice(30).some((c) => c.low < asianLow && c.close > asianLow);

  levels.push({
    type: 'ASH',
    price: asianHigh,
    label: 'ASH (Asian High Liquidity)',
    swept: asianHighSwept,
  });

  levels.push({
    type: 'ASL',
    price: asianLow,
    label: 'ASL (Asian Low Liquidity)',
    swept: asianLowSwept,
  });

  // Swing Highs & Lows (BSL & SSL)
  for (let i = 5; i < candles.length - 5; i++) {
    const c = candles[i];
    const isSwingHigh = 
      c.high > candles[i - 1].high && 
      c.high > candles[i - 2].high && 
      c.high > candles[i + 1].high && 
      c.high > candles[i + 2].high;

    const isSwingLow = 
      c.low < candles[i - 1].low && 
      c.low < candles[i - 2].low && 
      c.low < candles[i + 1].low && 
      c.low < candles[i + 2].low;

    if (isSwingHigh && Math.abs(c.high - currentPrice) / currentPrice < 0.035) {
      const swept = candles.slice(i + 1).some((s) => s.high > c.high && s.close < c.high);
      levels.push({
        type: 'BSL',
        price: c.high,
        label: `BSL (Buy-Side Pool: $${c.high.toFixed(1)})`,
        swept,
        time: c.time,
      });
    }

    if (isSwingLow && Math.abs(c.low - currentPrice) / currentPrice < 0.035) {
      const swept = candles.slice(i + 1).some((s) => s.low < c.low && s.close > c.low);
      levels.push({
        type: 'SSL',
        price: c.low,
        label: `SSL (Sell-Side Pool: $${c.low.toFixed(1)})`,
        swept,
        time: c.time,
      });
    }
  }

  return levels.slice(-6);
}

/**
 * Calculates Market Structure (BOS, CHoCH / MSS, Premium vs Discount, and OTE Zone)
 */
export function calculateMarketStructure(candles: Candle[]): MarketStructure {
  if (candles.length < 10) {
    const p = candles[candles.length - 1]?.close || 65000;
    return {
      trend: 'RANGING',
      lastShift: 'NONE',
      swingHigh: p * 1.01,
      swingLow: p * 0.99,
      premiumDiscount: 'EQUILIBRIUM',
      equilibrium: p,
      oteZone: {
        upper: p * 1.005,
        lower: p * 0.995,
        optimal: p,
      },
    };
  }

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const swingHigh = Math.max(...highs);
  const swingLow = Math.min(...lows);
  const range = swingHigh - swingLow;
  const equilibrium = swingLow + range * 0.5;

  const currentPrice = candles[candles.length - 1].close;
  const fibRatio = range > 0 ? (currentPrice - swingLow) / range : 0.5;

  let premiumDiscount: MarketStructure['premiumDiscount'] = 'EQUILIBRIUM';
  if (fibRatio > 0.79) premiumDiscount = 'DEEP_PREMIUM';
  else if (fibRatio > 0.55) premiumDiscount = 'PREMIUM';
  else if (fibRatio < 0.21) premiumDiscount = 'DEEP_DISCOUNT';
  else if (fibRatio < 0.45) premiumDiscount = 'DISCOUNT';

  // Optimal Trade Entry (OTE) Fibs: 0.618 to 0.786 retracement, sweet spot at 0.705
  // For bullish continuation: retracement into discount
  const oteUpper = swingLow + range * (1 - 0.618);
  const oteLower = swingLow + range * (1 - 0.786);
  const oteOptimal = swingLow + range * (1 - 0.705);

  // Trend detection via last 20 candles
  const recent = candles.slice(-20);
  const firstClose = recent[0].close;
  const lastClose = recent[recent.length - 1].close;
  const trend = lastClose > firstClose * 1.002 ? 'BULLISH' : lastClose < firstClose * 0.998 ? 'BEARISH' : 'RANGING';

  // Determine recent Shift (MSS / CHoCH or BOS)
  let lastShift: MarketStructure['lastShift'] = 'NONE';
  let shiftPrice: number | undefined;

  const prevSlice = candles.slice(-15, -5);
  const lastSlice = candles.slice(-5);
  const localHigh = Math.max(...prevSlice.map((c) => c.high));
  const localLow = Math.min(...prevSlice.map((c) => c.low));

  if (lastSlice.some((c) => c.close > localHigh)) {
    lastShift = 'BOS';
    shiftPrice = localHigh;
  } else if (lastSlice.some((c) => c.close < localLow)) {
    lastShift = 'MSS';
    shiftPrice = localLow;
  }

  return {
    trend,
    lastShift,
    shiftPrice,
    swingHigh,
    swingLow,
    premiumDiscount,
    equilibrium: Number(equilibrium.toFixed(2)),
    oteZone: {
      upper: Number(oteUpper.toFixed(2)),
      lower: Number(oteLower.toFixed(2)),
      optimal: Number(oteOptimal.toFixed(2)),
    },
  };
}

/**
 * Calculates Fixed Range Volume Profile (FRVP)
 * Yields POC (Point of Control), VAH (Value Area High 70%), and VAL (Value Area Low 70%)
 */
export function calculateVolumeProfile(candles: Candle[], binsCount: number = 24): VolumeProfileData {
  if (candles.length < 5) {
    const p = candles[candles.length - 1]?.close || 65000;
    return {
      poc: p,
      vah: p * 1.005,
      val: p * 0.995,
      totalVolume: 1000,
      buyVolume: 500,
      sellVolume: 500,
      nodes: [],
    };
  }

  const minPrice = Math.min(...candles.map((c) => c.low));
  const maxPrice = Math.max(...candles.map((c) => c.high));
  const priceRange = maxPrice - minPrice || 1;
  const binStep = priceRange / binsCount;

  const bins: { price: number; volume: number; buyVol: number; sellVol: number }[] = [];
  for (let i = 0; i < binsCount; i++) {
    bins.push({
      price: minPrice + (i + 0.5) * binStep,
      volume: 0,
      buyVol: 0,
      sellVol: 0,
    });
  }

  let totalVolume = 0;
  let totalBuy = 0;
  let totalSell = 0;

  for (const c of candles) {
    const vol = c.volume || 10;
    const isBull = c.close >= c.open;
    const buyPortion = isBull ? vol * 0.65 : vol * 0.35;
    const sellPortion = vol - buyPortion;

    totalVolume += vol;
    totalBuy += buyPortion;
    totalSell += sellPortion;

    // Distribute across high to low of candle
    const binIdx = Math.min(binsCount - 1, Math.max(0, Math.floor((c.close - minPrice) / binStep)));
    bins[binIdx].volume += vol;
    bins[binIdx].buyVol += buyPortion;
    bins[binIdx].sellVol += sellPortion;
  }

  // Find POC (Bin with highest volume)
  let maxBinVol = 0;
  let pocIdx = 0;
  bins.forEach((b, idx) => {
    if (b.volume > maxBinVol) {
      maxBinVol = b.volume;
      pocIdx = idx;
    }
  });

  const poc = bins[pocIdx].price;

  // Compute 70% Value Area starting from POC expanding outwards
  const targetVaVolume = totalVolume * 0.70;
  let vaVolume = bins[pocIdx].volume;
  let left = pocIdx;
  let right = pocIdx;

  while (vaVolume < targetVaVolume && (left > 0 || right < binsCount - 1)) {
    const leftVol = left > 0 ? bins[left - 1].volume : 0;
    const rightVol = right < binsCount - 1 ? bins[right + 1].volume : 0;

    if (leftVol >= rightVol && left > 0) {
      left--;
      vaVolume += bins[left].volume;
    } else if (right < binsCount - 1) {
      right++;
      vaVolume += bins[right].volume;
    } else if (left > 0) {
      left--;
      vaVolume += bins[left].volume;
    } else {
      break;
    }
  }

  const val = bins[left].price;
  const vah = bins[right].price;

  const nodes: VolumeProfileNode[] = bins.map((b, idx) => ({
    price: Number(b.price.toFixed(2)),
    volume: Math.round(b.volume),
    buyVol: Math.round(b.buyVol),
    sellVol: Math.round(b.sellVol),
    isPoc: idx === pocIdx,
    inValueArea: idx >= left && idx <= right,
  }));

  return {
    poc: Number(poc.toFixed(2)),
    vah: Number(vah.toFixed(2)),
    val: Number(val.toFixed(2)),
    totalVolume: Math.round(totalVolume),
    buyVolume: Math.round(totalBuy),
    sellVolume: Math.round(totalSell),
    nodes,
  };
}

/**
 * Calculates Cumulative Volume Delta (CVD) and checks for Delta Divergence
 */
export function calculateCVD(candles: Candle[]): CvdData {
  if (candles.length < 5) {
    return {
      delta: 0,
      cumulativeDelta: 0,
      buyRatio: 0.5,
      divergenceAlert: 'NONE',
    };
  }

  let cumulativeDelta = 0;
  const deltaSeries: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const isBull = c.close >= c.open;
    const spread = Math.max(0.01, c.high - c.low);
    const body = Math.abs(c.close - c.open);
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    // Delta estimate from wick pressure and body direction
    const buyerDominance = (body / spread) * (isBull ? 0.7 : -0.7) + ((lowerWick - upperWick) / spread) * 0.3;
    const candleDelta = c.volume * buyerDominance;

    cumulativeDelta += candleDelta;
    deltaSeries.push(cumulativeDelta);
  }

  const recentCandles = candles.slice(-10);
  const recentDeltas = deltaSeries.slice(-10);

  const priceTrend = recentCandles[recentCandles.length - 1].close - recentCandles[0].close;
  const deltaTrend = recentDeltas[recentDeltas.length - 1] - recentDeltas[0];

  let divergenceAlert: CvdData['divergenceAlert'] = 'NONE';
  // Bullish Absorption: Price dropping or flat while delta is aggressively accumulating
  if (priceTrend <= 0 && deltaTrend > 0) {
    divergenceAlert = 'BULLISH_ABSORPTION';
  } else if (priceTrend >= 0 && deltaTrend < 0) {
    divergenceAlert = 'BEARISH_EXHAUSTION';
  }

  const lastDelta = deltaSeries[deltaSeries.length - 1] - deltaSeries[deltaSeries.length - 2];
  const lastVol = candles[candles.length - 1].volume || 1;
  const buyRatio = Math.min(0.95, Math.max(0.05, 0.5 + (lastDelta / lastVol) * 0.5));

  return {
    delta: Math.round(lastDelta),
    cumulativeDelta: Math.round(cumulativeDelta),
    buyRatio: Number(buyRatio.toFixed(2)),
    divergenceAlert,
  };
}

/**
 * Detects current ICT Session Killzone and manipulation status
 */
export function getCurrentKillzone(): KillzoneInfo {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const utcMins = now.getUTCMinutes();
  const totalUtcMins = utcHours * 60 + utcMins;

  // Session boundaries in UTC:
  // Asia: 00:00 - 08:00 (0 - 480 mins)
  // London Open Killzone: 07:00 - 10:00 (420 - 600 mins)
  // New York Open Killzone: 12:00 - 15:00 (720 - 900 mins)
  // London Close / NY PM: 15:00 - 17:00 (900 - 1020 mins)
  // Off Hours: 17:00 - 00:00

  let activeKillzone: KillzoneInfo['activeKillzone'] = 'OFF_HOURS';
  let label = 'Off-Hours / Low Liquidity Window';
  let description = 'Reduced institutional participation. Guard against chop and spread expansion.';
  let manipulationState: KillzoneInfo['manipulationState'] = 'ACCUMULATION';
  let timeRemaining = '0m';

  if (totalUtcMins >= 720 && totalUtcMins < 900) {
    activeKillzone = 'NY_OPEN';
    label = 'NEW YORK OPEN KILLZONE (12:00 - 15:00 UTC)';
    description = 'Peak US institutional volume & news catalyst window. Massive liquidity injection in BTC & Gold.';
    manipulationState = totalUtcMins < 780 ? 'JUDAS_SWEEP' : 'EXPANSION';
    const rem = 900 - totalUtcMins;
    timeRemaining = `${Math.floor(rem / 60)}h ${rem % 60}m remaining`;
  } else if (totalUtcMins >= 420 && totalUtcMins < 600) {
    activeKillzone = 'LONDON_OPEN';
    label = 'LONDON OPEN KILLZONE (07:00 - 10:00 UTC)';
    description = 'European institutional open. Classic Judas Swing establishing the High/Low of the Day.';
    manipulationState = totalUtcMins < 480 ? 'JUDAS_SWEEP' : 'EXPANSION';
    const rem = 600 - totalUtcMins;
    timeRemaining = `${Math.floor(rem / 60)}h ${rem % 60}m remaining`;
  } else if (totalUtcMins >= 900 && totalUtcMins < 1020) {
    activeKillzone = 'LONDON_CLOSE';
    label = 'LONDON CLOSE KILLZONE (15:00 - 17:00 UTC)';
    description = 'European fix & daily profit-taking. Common counter-trend retracements.';
    manipulationState = 'DISTRIBUTION';
    const rem = 1020 - totalUtcMins;
    timeRemaining = `${Math.floor(rem / 60)}h ${rem % 60}m remaining`;
  } else if (totalUtcMins < 480) {
    activeKillzone = 'ASIA';
    label = 'ASIAN SESSION RANGE (00:00 - 08:00 UTC)';
    description = 'Tokyo/Sydney liquidity building phase. Range high & low form primary targets for London sweep.';
    manipulationState = 'ACCUMULATION';
    const rem = 480 - totalUtcMins;
    timeRemaining = `${Math.floor(rem / 60)}h ${rem % 60}m remaining`;
  } else {
    activeKillzone = 'OFF_HOURS';
    label = 'NY PM CLOSE (17:00 - 00:00 UTC)';
    description = 'Market rebalancing and spread settlement. Favorable for range trading.';
    manipulationState = 'DISTRIBUTION';
    const rem = 1440 - totalUtcMins;
    timeRemaining = `${Math.floor(rem / 60)}h ${rem % 60}m remaining`;
  }

  return {
    activeKillzone,
    label,
    timeRemaining,
    description,
    manipulationState,
    sessionRange: {
      high: 0,
      low: 0,
      sweptHigh: false,
      sweptLow: false,
    },
  };
}
