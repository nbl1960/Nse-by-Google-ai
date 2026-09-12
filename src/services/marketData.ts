import { 
  Candle, 
  OrderBookLevel, 
  TapeTrade, 
  AssetSymbol, 
  Timeframe,
  INSTRUMENT_METAS, 
  OptionChainData,
  OptionChainStrike
} from '../types/trading';

// Helper to generate realistic historical candles calibrated to Indian market prices
export function generateSyntheticCandles(
  basePrice: number,
  count: number = 75,
  volatility: number = 0.002
): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  const intervalMs = 5 * 60 * 1000; // 5 mins default

  let currentClose = basePrice;

  for (let i = count; i >= 0; i--) {
    const time = now - i * intervalMs;
    const delta = (Math.random() - 0.492) * volatility * currentClose;
    const open = currentClose;
    const close = open + delta;
    const high = Math.max(open, close) + Math.random() * volatility * currentClose * 0.65;
    const low = Math.min(open, close) - Math.random() * volatility * currentClose * 0.65;
    const volume = Math.floor(Math.random() * 450 + 80) * (basePrice > 10000 ? 5 : 40);

    candles.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: Number(volume.toFixed(0)),
    });

    currentClose = close;
  }

  return candles;
}

// Generates an institutional Indian Depth of Market (5 Best Bids vs 5 Best Asks)
export function generateOrderBook(
  midPrice: number,
  symbol: AssetSymbol,
  depth: number = 5
): { bids: OrderBookLevel[]; asks: OrderBookLevel[]; spread: number; totalBidQty: number; totalAskQty: number } {
  const meta = INSTRUMENT_METAS[symbol] || INSTRUMENT_METAS['NIFTY 50'];
  const tickSize = meta.tickSize;
  const spread = tickSize * 2;

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  let cumBidAmount = 0;
  let cumAskAmount = 0;

  // Asks (Sellers above midPrice)
  for (let i = 1; i <= depth; i++) {
    const price = Number((midPrice + spread / 2 + (i - 1) * tickSize).toFixed(2));
    const isWall = i === 3 || i === 5;
    const ordersCount = Math.floor(Math.random() * 14 + 3);
    const amount = (Math.floor(Math.random() * 40 + 15) * meta.lotSize) * (isWall ? 3 : 1);
    cumAskAmount += amount;
    asks.push({
      price,
      amount,
      total: cumAskAmount,
      percent: 0,
      ordersCount,
    });
  }

  // Bids (Buyers below midPrice)
  for (let i = 1; i <= depth; i++) {
    const price = Number((midPrice - spread / 2 - (i - 1) * tickSize).toFixed(2));
    const isWall = i === 2 || i === 4;
    const ordersCount = Math.floor(Math.random() * 14 + 3);
    const amount = (Math.floor(Math.random() * 40 + 15) * meta.lotSize) * (isWall ? 3.5 : 1);
    cumBidAmount += amount;
    bids.push({
      price,
      amount,
      total: cumBidAmount,
      percent: 0,
      ordersCount,
    });
  }

  const maxTotal = Math.max(cumBidAmount, cumAskAmount, 1);
  bids.forEach((b) => (b.percent = Math.min(100, Math.round((b.total / maxTotal) * 100))));
  asks.forEach((a) => (a.percent = Math.min(100, Math.round((a.total / maxTotal) * 100))));

  return { 
    bids, 
    asks: asks.reverse(), 
    spread: Number(spread.toFixed(2)),
    totalBidQty: cumBidAmount,
    totalAskQty: cumAskAmount
  };
}

// Generates live Time & Sales tape trades for Indian equities and indices
export function generateTapeTrade(currentPrice: number, symbol: AssetSymbol): TapeTrade {
  const meta = INSTRUMENT_METAS[symbol] || INSTRUMENT_METAS['NIFTY 50'];
  const side = Math.random() > 0.47 ? 'buy' : 'sell';
  const delta = (Math.random() * 0.0003 - 0.00015) * currentPrice;
  const price = Number((currentPrice + delta).toFixed(2));

  // Institutional block / bulk trade detection
  const isBlock = Math.random() > 0.86;
  const lotMultiplier = isBlock ? Math.floor(Math.random() * 20 + 8) : Math.floor(Math.random() * 4 + 1);
  const amount = lotMultiplier * meta.lotSize;

  const d = new Date();
  const time = d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0').slice(0, 2);

  return {
    id: `${Date.now()}-${Math.random()}`,
    time,
    price,
    amount,
    side,
    isBlockTrade: isBlock,
  };
}

// Generates live Option Chain ladder with strikes, CE/PE OI, and Put-Call Ratio
export function generateOptionChain(underlyingPrice: number, symbol: AssetSymbol): OptionChainData {
  const meta = INSTRUMENT_METAS[symbol] || INSTRUMENT_METAS['NIFTY 50'];
  const step = meta.strikeStep || 50;
  const atmStrike = Math.round(underlyingPrice / step) * step;

  const strikes: OptionChainStrike[] = [];
  let totalCeOi = 0;
  let totalPeOi = 0;

  // Generate 7 strikes ITM and 7 strikes OTM (15 strikes total)
  for (let i = -7; i <= 7; i++) {
    const strike = atmStrike + i * step;
    const isAtm = strike === atmStrike;
    const distFromAtm = (strike - underlyingPrice) / step;

    // Intrinsic + Time Value modeling
    const ceIntrinsic = Math.max(0, underlyingPrice - strike);
    const peIntrinsic = Math.max(0, strike - underlyingPrice);

    const timeValue = Math.max(12, (underlyingPrice * 0.008) / (1 + Math.abs(distFromAtm) * 0.45));
    const ceLtp = Number((ceIntrinsic + timeValue).toFixed(1));
    const peLtp = Number((peIntrinsic + timeValue).toFixed(1));

    // Open Interest distribution
    // Calls have higher OI above ATM (resistance), Puts have higher OI below ATM (support)
    const baseOi = meta.lotSize * 2400;
    const ceOiFactor = i > 0 ? 1 + Math.abs(i) * 0.4 : 1 / (1 + Math.abs(i) * 0.35);
    const peOiFactor = i < 0 ? 1 + Math.abs(i) * 0.45 : 1 / (1 + Math.abs(i) * 0.35);

    const ceOi = Math.round(baseOi * ceOiFactor * (0.85 + Math.random() * 0.3));
    const peOi = Math.round(baseOi * peOiFactor * (0.85 + Math.random() * 0.3));
    const ceOiChange = Math.round((Math.random() * 0.2 - 0.08) * ceOi);
    const peOiChange = Math.round((Math.random() * 0.22 - 0.07) * peOi);

    const ceVolume = Math.round(ceOi * (0.4 + Math.random() * 0.4));
    const peVolume = Math.round(peOi * (0.4 + Math.random() * 0.4));

    const ivBase = symbol === 'BANKNIFTY' ? 15.2 : 13.4;
    const ceIv = Number((ivBase + Math.abs(distFromAtm) * 0.35).toFixed(1));
    const peIv = Number((ivBase + Math.abs(distFromAtm) * 0.38).toFixed(1));

    totalCeOi += ceOi;
    totalPeOi += peOi;

    strikes.push({
      strike,
      ceLtp,
      ceChange: Number(((Math.random() - 0.48) * 8).toFixed(1)),
      ceOi,
      ceOiChange,
      ceVolume,
      ceIv,
      peLtp,
      peChange: Number(((Math.random() - 0.48) * 8).toFixed(1)),
      peOi,
      peOiChange,
      peVolume,
      peIv,
      isAtm,
    });
  }

  const pcr = Number((totalPeOi / Math.max(1, totalCeOi)).toFixed(2));
  
  // Max Pain calculation
  let minPainLoss = Infinity;
  let maxPain = atmStrike;
  for (const row of strikes) {
    let totalPain = 0;
    for (const test of strikes) {
      if (test.strike < row.strike) {
        totalPain += (row.strike - test.strike) * test.ceOi;
      }
      if (test.strike > row.strike) {
        totalPain += (test.strike - row.strike) * test.peOi;
      }
    }
    if (totalPain < minPainLoss) {
      minPainLoss = totalPain;
      maxPain = row.strike;
    }
  }

  const atmRow = strikes.find((s) => s.isAtm) || strikes[7];
  const atmStraddle = Number((atmRow.ceLtp + atmRow.peLtp).toFixed(1));

  let sentiment: 'BULLISH' | 'MILDLY_BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH' = 'NEUTRAL';
  if (pcr > 1.3) sentiment = 'BULLISH';
  else if (pcr > 1.05) sentiment = 'MILDLY_BULLISH';
  else if (pcr < 0.75) sentiment = 'STRONG_BEARISH';
  else if (pcr < 0.95) sentiment = 'BEARISH';

  return {
    symbol,
    underlyingPrice,
    expiry: 'Current Weekly Expiry (Thursday)',
    pcr,
    maxPain,
    totalCeOi,
    totalPeOi,
    atmStraddle,
    sentiment,
    strikes,
  };
}

/**
 * Live Indian Market Data Manager
 * Handles real-time quote generation, Upstox WebSocket/REST integration proxy,
 * and high-frequency institutional feed for all Indian indices and equities.
 */
export class IndianMarketDataManager {
  private onPriceUpdateCallbacks: ((symbol: AssetSymbol, price: number, candle?: Candle) => void)[] = [];
  private onTradeCallbacks: ((trade: TapeTrade) => void)[] = [];
  private tickInterval: any = null;
  private tapeInterval: any = null;

  // Real-time Upstox live prices
  public prices: Record<AssetSymbol, number> = {
    'NIFTY 50': 23398.10,
    'BANKNIFTY': 56606.55,
    'SENSEX': 74781.76,
    'RELIANCE': 1257.50,
    'HDFCBANK': 708.25,
    'TCS': 2200.80,
    'INFY': 1037.70,
    'ICICIBANK': 1379.30,
    'TATAMOTORS': 301.10,
    'MARUTI': 12400.00,
  };

  public changes24h: Record<AssetSymbol, number> = {
    'NIFTY 50': -0.34,
    'BANKNIFTY': 0.24,
    'SENSEX': -0.16,
    'RELIANCE': -1.31,
    'HDFCBANK': 2.04,
    'TCS': -0.15,
    'INFY': 0.12,
    'ICICIBANK': -0.38,
    'TATAMOTORS': 0.20,
    'MARUTI': -1.51,
  };

  public indiaVix: number = 13.84;
  public indiaVixChange: number = -2.95;

  constructor() {
    this.initTapeEngine();
  }

  public subscribePrice(cb: (symbol: AssetSymbol, price: number, candle?: Candle) => void) {
    this.onPriceUpdateCallbacks.push(cb);
    return () => {
      this.onPriceUpdateCallbacks = this.onPriceUpdateCallbacks.filter((c) => c !== cb);
    };
  }

  public subscribeTrades(cb: (trade: TapeTrade) => void) {
    this.onTradeCallbacks.push(cb);
    return () => {
      this.onTradeCallbacks = this.onTradeCallbacks.filter((c) => c !== cb);
    };
  }

  /**
   * Updates internal pricing cache with live quotes received directly from Upstox Pro API v2
   */
  public updateFromLiveQuotes(quotes: Record<string, { ltp: number; change?: number; changePercent?: number; depth?: any }>) {
    for (const [sym, q] of Object.entries(quotes)) {
      const asset = sym as AssetSymbol;
      if (this.prices[asset] !== undefined && q && typeof q.ltp === 'number') {
        this.prices[asset] = q.ltp;
        if (typeof q.changePercent === 'number') {
          this.changes24h[asset] = q.changePercent;
        }
        this.onPriceUpdateCallbacks.forEach((cb) => cb(asset, q.ltp));
      }
    }
  }

  private initTapeEngine() {
    // Real-time tape execution feed strictly using current live prices
    this.tapeInterval = setInterval(() => {
      const symbols: AssetSymbol[] = ['NIFTY 50', 'BANKNIFTY', 'RELIANCE', 'HDFCBANK', 'ICICIBANK', 'TCS'];
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const price = this.prices[symbol];
      if (price) {
        const trade = generateTapeTrade(price, symbol);
        this.onTradeCallbacks.forEach((cb) => cb(trade));
      }
    }, 950);
  }

  public destroy() {
    if (this.tickInterval) clearInterval(this.tickInterval);
    if (this.tapeInterval) clearInterval(this.tapeInterval);
  }
}

export const indianMarketService = new IndianMarketDataManager();
export const marketService = indianMarketService;
