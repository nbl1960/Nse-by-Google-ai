export type AssetSymbol = 
  | 'NIFTY 50'
  | 'BANKNIFTY'
  | 'SENSEX'
  | 'RELIANCE'
  | 'HDFCBANK'
  | 'TCS'
  | 'INFY'
  | 'ICICIBANK'
  | 'TATAMOTORS'
  | 'MARUTI';

export type Timeframe = '1m' | '3m' | '5m' | '15m' | '1h' | '1D';

export type ProductType = 'MIS' | 'CNC' | 'NRML';

export interface InstrumentMeta {
  symbol: AssetSymbol;
  name: string;
  exchange: 'NSE_INDEX' | 'NSE_EQ' | 'BSE_INDEX';
  lotSize: number;
  tickSize: number;
  strikeStep: number;
  upstoxKey: string;
  isIndex: boolean;
  basePrice: number;
}

export const INSTRUMENT_METAS: Record<AssetSymbol, InstrumentMeta> = {
  'NIFTY 50': {
    symbol: 'NIFTY 50',
    name: 'NIFTY 50 Index',
    exchange: 'NSE_INDEX',
    lotSize: 25,
    tickSize: 0.05,
    strikeStep: 50,
    upstoxKey: 'NSE_INDEX|Nifty 50',
    isIndex: true,
    basePrice: 23398.10,
  },
  'BANKNIFTY': {
    symbol: 'BANKNIFTY',
    name: 'NIFTY Bank Index',
    exchange: 'NSE_INDEX',
    lotSize: 15,
    tickSize: 0.05,
    strikeStep: 100,
    upstoxKey: 'NSE_INDEX|Nifty Bank',
    isIndex: true,
    basePrice: 56606.55,
  },
  'SENSEX': {
    symbol: 'SENSEX',
    name: 'BSE SENSEX Index',
    exchange: 'BSE_INDEX',
    lotSize: 10,
    tickSize: 0.05,
    strikeStep: 100,
    upstoxKey: 'BSE_INDEX|SENSEX',
    isIndex: true,
    basePrice: 74781.76,
  },
  'RELIANCE': {
    symbol: 'RELIANCE',
    name: 'Reliance Industries Ltd',
    exchange: 'NSE_EQ',
    lotSize: 250,
    tickSize: 0.05,
    strikeStep: 20,
    upstoxKey: 'NSE_EQ|INE002A01018',
    isIndex: false,
    basePrice: 1257.50,
  },
  'HDFCBANK': {
    symbol: 'HDFCBANK',
    name: 'HDFC Bank Ltd',
    exchange: 'NSE_EQ',
    lotSize: 550,
    tickSize: 0.05,
    strikeStep: 10,
    upstoxKey: 'NSE_EQ|INE040A01034',
    isIndex: false,
    basePrice: 708.25,
  },
  'TCS': {
    symbol: 'TCS',
    name: 'Tata Consultancy Services',
    exchange: 'NSE_EQ',
    lotSize: 175,
    tickSize: 0.05,
    strikeStep: 20,
    upstoxKey: 'NSE_EQ|INE467B01029',
    isIndex: false,
    basePrice: 2200.80,
  },
  'INFY': {
    symbol: 'INFY',
    name: 'Infosys Ltd',
    exchange: 'NSE_EQ',
    lotSize: 400,
    tickSize: 0.05,
    strikeStep: 10,
    upstoxKey: 'NSE_EQ|INE009A01021',
    isIndex: false,
    basePrice: 1037.70,
  },
  'ICICIBANK': {
    symbol: 'ICICIBANK',
    name: 'ICICI Bank Ltd',
    exchange: 'NSE_EQ',
    lotSize: 700,
    tickSize: 0.05,
    strikeStep: 10,
    upstoxKey: 'NSE_EQ|INE090A01021',
    isIndex: false,
    basePrice: 1379.30,
  },
  'TATAMOTORS': {
    symbol: 'TATAMOTORS',
    name: 'Tata Motors Ltd',
    exchange: 'NSE_EQ',
    lotSize: 575,
    tickSize: 0.05,
    strikeStep: 5,
    upstoxKey: 'NSE_EQ|INE155A01022',
    isIndex: false,
    basePrice: 301.10,
  },
  'MARUTI': {
    symbol: 'MARUTI',
    name: 'Maruti Suzuki India Ltd',
    exchange: 'NSE_EQ',
    lotSize: 50,
    tickSize: 0.05,
    strikeStep: 100,
    upstoxKey: 'NSE_EQ|INE585B01010',
    isIndex: false,
    basePrice: 12400.00,
  },
};

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

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

export interface FVGZone {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  startIndex: number;
  mitigated: boolean;
}

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  startIndex: number;
  status: 'fresh' | 'mitigated';
}

export interface LiquidityLevel {
  type: 'BSL' | 'SSL';
  price: number;
  label: string;
  swept: boolean;
}

export interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;
  percent: number;
  ordersCount?: number;
}

export interface TapeTrade {
  id: string;
  time: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  isBlockTrade?: boolean;
}

export interface Position {
  id: string;
  symbol: AssetSymbol;
  instrumentType?: 'FUTURES' | 'OPTIONS' | 'EQUITY';
  optionDetails?: {
    strike: number;
    optionType: 'CE' | 'PE';
    expiry: string;
  };
  product: ProductType;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  currentPrice: number;
  size: number; // Quantity in units
  lots: number;
  leverage: number;
  margin: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  openTime: string | number;
}

export interface WorkingOrder {
  id: string;
  symbol: AssetSymbol;
  type: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  product: ProductType;
  side: 'BUY' | 'SELL';
  price: number;
  triggerPrice?: number;
  size: number;
  lots: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  timestamp?: string;
  createdAt?: string | number;
}

export interface TradeHistoryItem {
  id: string;
  symbol: AssetSymbol;
  side: 'BUY' | 'SELL';
  product?: ProductType;
  entryPrice: number;
  exitPrice: number;
  size: number;
  lots?: number;
  pnl: number;
  pnlPercent: number;
  closeTime?: string;
  exitTime?: string | number;
  setupName?: string;
  exitReason?: string;
}

export interface InstitutionalSetup {
  asset: AssetSymbol;
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  setupName: string;
  instrumentRecommendation: string; // e.g. "NIFTY 25100 CE" or "BANKNIFTY 51600 PE"
  confluenceScore: number; // 0 - 100
  winProbability: number; // e.g. 82%
  riskRewardRatio: string; // e.g. 1:2.8
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  cprContext: string;
  optionOiContext: string;
  keyConfluences: string[];
  invalidationRule: string;
  institutionalRationale: string;
  executionChecklist: string[];
  timestamp?: string;
}

export interface ConfluenceFactor {
  id: string;
  category: 'CPR_PIVOT' | 'SMC' | 'OPTION_OI' | 'FII_DII' | 'INDIA_VIX' | 'BREADTH' | 'ORDER_FLOW' | 'INDICATORS';
  name: string;
  status: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score?: number; // 0 to 100
  weight?: number; // 0 to 100
  detail: string;
  institutionalSignificance: string;
}

export interface OptionChainStrike {
  strike: number;
  ceLtp: number;
  ceChange: number;
  ceOi: number;
  ceOiChange: number;
  ceVolume: number;
  ceIv: number;
  peLtp: number;
  peChange: number;
  peOi: number;
  peOiChange: number;
  peVolume: number;
  peIv: number;
  isAtm: boolean;
}

export interface OptionChainData {
  symbol: AssetSymbol;
  underlyingPrice: number;
  expiry: string;
  pcr: number;
  maxPain: number;
  totalCeOi: number;
  totalPeOi: number;
  atmStraddle: number;
  sentiment: 'BULLISH' | 'MILDLY_BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONG_BEARISH';
  strikes: OptionChainStrike[];
}

export interface MacroData {
  activeSession: string; // "NSE Regular Trading Session (09:15 - 15:30 IST)"
  indiaVix: {
    value: number;
    change: number;
    regime?: string; // "Low Volatility (Option Writing Favored)" or "Active Trend Zone"
    trend?: string;
  };
  fiiDiiFlow?: {
    fiiNet: number; // In ₹ Crores e.g. -1240.5
    diiNet: number; // In ₹ Crores e.g. +2180.2
    totalNet: number;
    bias: string;
  };
  fiiDii?: {
    fiiNetCr: number;
    diiNetCr: number;
  };
  usdInr?: {
    value: number;
    trend: string;
  };
  marketBreadth?: {
    advances: number;
    declines: number;
    unchanged: number;
    ratio: number;
  };
  niftyPcr?: number;
  bankniftyPcr?: number;
  sectoralPerformance?: {
    name: string;
    change: number;
    leadStock: string;
  }[];
}

export interface UpstoxBrokerStatus {
  connected: boolean;
  mode: 'LIVE' | 'SIMULATED' | 'SIMULATION';
  brokerName: string;
  clientName: string;
  userId: string;
  tokenMasked?: string;
  hasToken: boolean;
  balance?: number; // in ₹ INR
  utilizedMargin?: number;
  availableMargin?: number;
  tokenExpiry?: string;
  liveFeed?: string;
  marketOpen?: boolean;
  feedLatencyMs?: number;
  error?: string;
}

export interface AccountStats {
  balance: number; // in ₹ INR
  equity: number;
  marginUsed: number;
  freeMargin: number;
  marginLevel: number;
  realizedPnl: number;
  totalTrades: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  profitFactor: number;
}
