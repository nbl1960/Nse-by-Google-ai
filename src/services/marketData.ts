import { 
  Candle, 
  OrderBookLevel, 
  TapeTrade, 
  AssetSymbol, 
  Timeframe,
  INSTRUMENT_METAS, 
  MacroIntermarketData,
  MacroEconomicEvent
} from '../types/trading';

/**
 * Generates realistic historical candles calibrated to asset class volatility
 */
export function generateSyntheticCandles(
  basePrice: number,
  count: number = 100,
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
    const high = Math.max(open, close) + Math.random() * volatility * currentClose * 0.7;
    const low = Math.min(open, close) - Math.random() * volatility * currentClose * 0.7;
    const volume = Math.floor(Math.random() * 450 + 80) * (basePrice > 10000 ? 2 : 25);

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

/**
 * Generates an institutional Depth of Market (L2 Order Book)
 */
export function generateOrderBook(
  midPrice: number,
  symbol: AssetSymbol,
  depth: number = 8
): { bids: OrderBookLevel[]; asks: OrderBookLevel[]; spread: number; totalBidQty: number; totalAskQty: number } {
  const meta = INSTRUMENT_METAS[symbol] || INSTRUMENT_METAS['BTC/USD'];
  const tickSize = meta.tickSize;
  const spread = symbol === 'BTC/USD' ? 0.50 : 0.25;

  const bids: OrderBookLevel[] = [];
  const asks: OrderBookLevel[] = [];

  let cumBidAmount = 0;
  let cumAskAmount = 0;

  // Asks (Sellers above midPrice)
  for (let i = 1; i <= depth; i++) {
    const price = Number((midPrice + spread / 2 + (i - 1) * tickSize * (symbol === 'BTC/USD' ? 5 : 2)).toFixed(2));
    const isIceberg = i === 3 || i === 6;
    const baseAmt = symbol === 'BTC/USD' ? (Math.random() * 3.5 + 0.4) : (Math.random() * 25 + 4);
    const amount = Number((baseAmt * (isIceberg ? 3.8 : 1)).toFixed(symbol === 'BTC/USD' ? 3 : 1));
    cumAskAmount += amount;
    asks.push({
      price,
      amount,
      total: Number(cumAskAmount.toFixed(2)),
      percent: 0,
      ordersCount: Math.floor(Math.random() * 12 + 3),
      isIceberg,
    });
  }

  // Bids (Buyers below midPrice)
  for (let i = 1; i <= depth; i++) {
    const price = Number((midPrice - spread / 2 - (i - 1) * tickSize * (symbol === 'BTC/USD' ? 5 : 2)).toFixed(2));
    const isIceberg = i === 2 || i === 5;
    const baseAmt = symbol === 'BTC/USD' ? (Math.random() * 3.5 + 0.4) : (Math.random() * 25 + 4);
    const amount = Number((baseAmt * (isIceberg ? 4.2 : 1)).toFixed(symbol === 'BTC/USD' ? 3 : 1));
    cumBidAmount += amount;
    bids.push({
      price,
      amount,
      total: Number(cumBidAmount.toFixed(2)),
      percent: 0,
      ordersCount: Math.floor(Math.random() * 12 + 3),
      isIceberg,
    });
  }

  const maxTotal = Math.max(cumBidAmount, cumAskAmount, 1);
  bids.forEach((b) => (b.percent = Math.min(100, Math.round((b.total / maxTotal) * 100))));
  asks.forEach((a) => (a.percent = Math.min(100, Math.round((a.total / maxTotal) * 100))));

  return {
    bids,
    asks,
    spread: Number(spread.toFixed(2)),
    totalBidQty: Number(cumBidAmount.toFixed(2)),
    totalAskQty: Number(cumAskAmount.toFixed(2)),
  };
}

/**
 * Generates initial Time & Sales tape trades
 */
export function generateInitialTape(midPrice: number, symbol: AssetSymbol, count: number = 18): TapeTrade[] {
  const trades: TapeTrade[] = [];
  const now = Date.now();

  for (let i = count; i >= 0; i--) {
    const side = Math.random() > 0.48 ? 'buy' : 'sell';
    const delta = (Math.random() - 0.5) * (symbol === 'BTC/USD' ? 4.0 : 0.4);
    const price = Number((midPrice + delta).toFixed(2));
    const isBlockTrade = Math.random() > 0.82;
    const amount = symbol === 'BTC/USD' 
      ? Number(((Math.random() * 1.5 + 0.1) * (isBlockTrade ? 6 : 1)).toFixed(3))
      : Number(((Math.random() * 12 + 1) * (isBlockTrade ? 8 : 1)).toFixed(1));
    const usdValue = Math.round(price * amount * (symbol === 'XAU/USD' ? 10 : 1));

    trades.push({
      id: `TR-${now - i * 1200}-${Math.random().toString(36).substring(2, 6)}`,
      time: new Date(now - i * 1200).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      price,
      amount,
      side,
      isBlockTrade,
      usdValue,
    });
  }

  return trades;
}

/**
 * Institutional Market Data Service with Binance Live Stream + High Frequency Micro-Tick Engine
 */
class InstitutionalMarketService {
  public prices: Record<AssetSymbol, number> = {
    'BTC/USD': 64850.00,
    'XAU/USD': 2642.50,
    'DXY': 101.45,
    'ETH/USD': 2580.00,
    'US10Y': 3.72,
    'XAG/USD': 31.40,
  };

  public changes24h: Record<AssetSymbol, number> = {
    'BTC/USD': 2.45,
    'XAU/USD': 0.85,
    'DXY': -0.32,
    'ETH/USD': 3.10,
    'US10Y': -0.80,
    'XAG/USD': 1.65,
  };

  public highs24h: Record<AssetSymbol, number> = {
    'BTC/USD': 65420.00,
    'XAU/USD': 2654.80,
    'DXY': 101.90,
    'ETH/USD': 2620.00,
    'US10Y': 3.76,
    'XAG/USD': 31.85,
  };

  public lows24h: Record<AssetSymbol, number> = {
    'BTC/USD': 63200.00,
    'XAU/USD': 2628.10,
    'DXY': 101.20,
    'ETH/USD': 2490.00,
    'US10Y': 3.69,
    'XAG/USD': 30.70,
  };

  private listeners: ((prices: Record<AssetSymbol, number>, changes: Record<AssetSymbol, number>) => void)[] = [];
  private tickInterval: any = null;
  private ws: WebSocket | null = null;
  private isWsConnected: boolean = false;

  constructor() {
    this.startLiveFeeds();
  }

  public subscribe(cb: (prices: Record<AssetSymbol, number>, changes: Record<AssetSymbol, number>) => void) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  private notify() {
    this.listeners.forEach((cb) => cb({ ...this.prices }, { ...this.changes24h }));
  }

  private startLiveFeeds() {
    // 1. Try public Binance WebSocket for live real-time BTC/USDT and PAXG/USDT
    this.connectBinanceWs();

    // 2. High-Frequency Micro-Tick Engine for sub-second institutional updates
    this.tickInterval = setInterval(() => {
      // Micro-fluctuations for Gold (XAU/USD)
      const goldDelta = (Math.random() - 0.495) * 0.15;
      this.prices['XAU/USD'] = Number((this.prices['XAU/USD'] + goldDelta).toFixed(2));

      // DXY and US10Y micro adjustments
      const dxyDelta = (Math.random() - 0.5) * 0.01;
      this.prices['DXY'] = Number((this.prices['DXY'] + dxyDelta).toFixed(2));

      // If WebSocket is disconnected or waiting, simulate realistic BTC micro-ticks
      if (!this.isWsConnected) {
        const btcDelta = (Math.random() - 0.492) * 2.8;
        this.prices['BTC/USD'] = Number((this.prices['BTC/USD'] + btcDelta).toFixed(2));
      }

      this.notify();
    }, 450);
  }

  private connectBinanceWs() {
    try {
      if (typeof window === 'undefined') return;
      // Connect to Binance multi-stream for BTC & PAXG (Gold token)
      const url = 'wss://stream.binance.com:9443/ws/btcusdt@ticker/paxgusdt@ticker';
      const socket = new WebSocket(url);

      socket.onopen = () => {
        this.isWsConnected = true;
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.s === 'BTCUSDT') {
            const price = parseFloat(data.c);
            const change = parseFloat(data.P);
            const high = parseFloat(data.h);
            const low = parseFloat(data.l);

            if (!isNaN(price)) {
              this.prices['BTC/USD'] = price;
              this.changes24h['BTC/USD'] = change;
              this.highs24h['BTC/USD'] = high;
              this.lows24h['BTC/USD'] = low;
              this.notify();
            }
          } else if (data.s === 'PAXGUSDT') {
            const price = parseFloat(data.c);
            const change = parseFloat(data.P);
            if (!isNaN(price) && price > 2000) {
              this.prices['XAU/USD'] = price;
              this.changes24h['XAU/USD'] = change;
              this.notify();
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      socket.onerror = () => {
        this.isWsConnected = false;
      };

      socket.onclose = () => {
        this.isWsConnected = false;
        // Reconnect after 5 seconds
        setTimeout(() => this.connectBinanceWs(), 5000);
      };

      this.ws = socket;
    } catch {
      this.isWsConnected = false;
    }
  }
}

export const institutionalMarketService = new InstitutionalMarketService();

/**
 * Economic calendar upcoming high impact events
 */
export const SAMPLE_ECONOMIC_EVENTS: MacroEconomicEvent[] = [
  {
    id: 'EV-1',
    time: '12:30 UTC',
    event: 'US Core CPI (MoM / YoY)',
    impact: 'HIGH',
    currency: 'USD',
    forecast: '0.2% / 3.2%',
    previous: '0.2% / 3.2%',
    countdown: 'T-02:14:20',
    isRedFolder: true,
  },
  {
    id: 'EV-2',
    time: '18:00 UTC',
    event: 'FOMC Interest Rate Decision & Powell Presser',
    impact: 'HIGH',
    currency: 'USD',
    forecast: '5.25% - 5.50%',
    previous: '5.50%',
    countdown: 'T-07:44:10',
    isRedFolder: true,
  },
  {
    id: 'EV-3',
    time: 'Tomorrow 12:30 UTC',
    event: 'US Non-Farm Payrolls (NFP)',
    impact: 'HIGH',
    currency: 'USD',
    forecast: '165K',
    previous: '142K',
    countdown: 'Tomorrow',
    isRedFolder: true,
  },
];
