export type AssetSymbol = 
  | 'BTC/USD'
  | 'XAU/USD'
  | 'DXY'
  | 'ETH/USD'
  | 'US10Y'
  | 'XAG/USD';

export type PrimaryTradeSymbol = 'BTC/USD' | 'XAU/USD';

export type Timeframe = '1m' | '3m' | '5m' | '15m' | '1h' | '4h' | '1D';

export type ProductType = 
  | 'PERPETUAL' 
  | 'SPOT' 
  | 'MARGIN' 
  | 'PERPETUAL_SWAP' 
  | 'ISOLATED_MARGIN' 
  | 'PHYSICAL_SPOT';

export interface InstrumentMeta {
  symbol: AssetSymbol;
  name: string;
  category: 'CRYPTO' | 'PRECIOUS_METALS' | 'MACRO_CURRENCY' | 'MACRO_YIELD';
  basePrice: number;
  tickSize: number;
  contractSize: number; // e.g. 1 BTC or 100 oz Gold
  lotStep: number;
  minOrderSize: number;
  maxLeverage: number;
  pointValueUsd: number;
  binanceSymbol?: string;
  tradingViewSymbol?: string;
  description: string;
}

export const INSTRUMENT_METAS: Record<AssetSymbol, InstrumentMeta> = {
  'BTC/USD': {
    symbol: 'BTC/USD',
    name: 'Bitcoin / US Dollar Perpetual',
    category: 'CRYPTO',
    basePrice: 64850.00,
    tickSize: 0.10,
    contractSize: 1.0,
    lotStep: 0.01,
    minOrderSize: 0.01,
    maxLeverage: 100,
    pointValueUsd: 1.0,
    binanceSymbol: 'BTCUSDT',
    tradingViewSymbol: 'BINANCE:BTCUSDT',
    description: 'Global Crypto Benchmark with 24/7 institutional liquidity & deep order book flow.',
  },
  'XAU/USD': {
    symbol: 'XAU/USD',
    name: 'Gold Spot / US Dollar',
    category: 'PRECIOUS_METALS',
    basePrice: 2642.50,
    tickSize: 0.01,
    contractSize: 100.0, // 100 troy oz standard institutional lot
    lotStep: 0.01, // 0.01 micro lot (1 oz)
    minOrderSize: 0.01,
    maxLeverage: 100,
    pointValueUsd: 10.0, // $10 per pip ($0.10 move) per 1.00 standard lot
    binanceSymbol: 'PAXGUSDT',
    tradingViewSymbol: 'OANDA:XAUUSD',
    description: 'Premier institutional safe-haven asset, sensitive to real yields, DXY, and geopolitical flows.',
  },
  'DXY': {
    symbol: 'DXY',
    name: 'US Dollar Index',
    category: 'MACRO_CURRENCY',
    basePrice: 101.45,
    tickSize: 0.01,
    contractSize: 1.0,
    lotStep: 0.1,
    minOrderSize: 0.1,
    maxLeverage: 50,
    pointValueUsd: 10.0,
    tradingViewSymbol: 'TVC:DXY',
    description: 'Global currency reserve index; strong inverse correlation to Gold (-0.88) and BTC (-0.74).',
  },
  'ETH/USD': {
    symbol: 'ETH/USD',
    name: 'Ethereum / US Dollar',
    category: 'CRYPTO',
    basePrice: 2580.00,
    tickSize: 0.05,
    contractSize: 1.0,
    lotStep: 0.05,
    minOrderSize: 0.05,
    maxLeverage: 50,
    pointValueUsd: 1.0,
    binanceSymbol: 'ETHUSDT',
    description: 'High-beta crypto risk gauge; ETH/BTC ratio signals altcoin liquidity injection.',
  },
  'US10Y': {
    symbol: 'US10Y',
    name: 'US 10-Year Treasury Yield',
    category: 'MACRO_YIELD',
    basePrice: 3.72,
    tickSize: 0.001,
    contractSize: 1.0,
    lotStep: 0.1,
    minOrderSize: 0.1,
    maxLeverage: 10,
    pointValueUsd: 10.0,
    description: 'Benchmark real interest rate indicator; inversely dictates non-yielding physical gold.',
  },
  'XAG/USD': {
    symbol: 'XAG/USD',
    name: 'Silver Spot / US Dollar',
    category: 'PRECIOUS_METALS',
    basePrice: 31.40,
    tickSize: 0.005,
    contractSize: 5000.0,
    lotStep: 0.01,
    minOrderSize: 0.01,
    maxLeverage: 50,
    pointValueUsd: 50.0,
    description: 'Industrial & monetary precious metal; Gold/Silver Ratio (GSR) signals precious metals cycles.',
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

export interface OrderBlock {
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  meanThreshold: number; // 50% midpoint
  startIndex: number;
  status: 'fresh' | 'tested' | 'mitigated';
  mitigated?: boolean;
  volumeScore: number;
  timeframe: Timeframe;
}

export interface FVGZone {
  type: 'bullish' | 'bearish';
  top: number;
  bottom: number;
  ce: number; // Consequent Encroachment (50% midpoint)
  startIndex: number;
  status: 'open' | 'partial' | 'mitigated';
  mitigated?: boolean;
  fillPercent: number;
  timeframe: Timeframe;
}

export interface LiquidityLevel {
  type: 'BSL' | 'SSL' | 'PDH' | 'PDL' | 'ASH' | 'ASL' | 'EQH' | 'EQL';
  price: number;
  label: string;
  swept: boolean;
  time?: number;
}

export interface MarketStructure {
  trend: 'BULLISH' | 'BEARISH' | 'RANGING';
  lastShift: 'BOS' | 'CHoCH' | 'MSS' | 'NONE';
  shiftPrice?: number;
  swingHigh: number;
  swingLow: number;
  premiumDiscount: 'DEEP_DISCOUNT' | 'DISCOUNT' | 'EQUILIBRIUM' | 'PREMIUM' | 'DEEP_PREMIUM';
  equilibrium: number;
  oteZone: {
    upper: number;
    lower: number;
    optimal: number; // 0.705 Fib
  };
}

export interface VolumeProfileNode {
  price: number;
  volume: number;
  buyVol: number;
  sellVol: number;
  isPoc: boolean;
  inValueArea: boolean;
}

export interface VolumeProfileData {
  poc: number;
  vah: number;
  val: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  nodes: VolumeProfileNode[];
}

export interface CvdData {
  delta: number;
  cumulativeDelta: number;
  buyRatio: number;
  divergenceAlert: 'NONE' | 'BULLISH_ABSORPTION' | 'BEARISH_EXHAUSTION';
}

export type KillzoneType = 'ASIA' | 'LONDON_OPEN' | 'NY_OPEN' | 'LONDON_CLOSE' | 'OFF_HOURS' | 'ASIAN_RANGE';

export interface KillzoneInfo {
  activeKillzone?: KillzoneType;
  activeZone?: string;
  label: string;
  timeRemaining: string;
  description: string;
  manipulationState: 'ACCUMULATION' | 'JUDAS_SWEEP' | 'EXPANSION' | 'DISTRIBUTION' | 'ASIAN RANGE HIGH/LOW PURGE' | 'JUDAS SWING EXPANSION' | 'LIQUIDITY ACCUMULATION' | 'PROFIT TAKING & RUNNERS';
  sessionRange?: {
    high: number;
    low: number;
    sweptHigh: boolean;
    sweptLow: boolean;
  };
}

export interface MacroEconomicEvent {
  id: string;
  time: string;
  event: string;
  impact: 'HIGH' | 'MED' | 'LOW';
  currency: string;
  forecast: string;
  previous: string;
  countdown: string;
  isRedFolder?: boolean;
}

export interface MacroIntermarketData {
  activeKillzone: KillzoneInfo;
  dxy: {
    value: number;
    change: number;
    correlationWithBtc: number; // e.g. -0.76
    correlationWithGold: number; // e.g. -0.88
    trend: 'BULLISH' | 'BEARISH' | 'CONSOLIDATING';
  };
  us10y: {
    value: number;
    change: number;
    impactOnGold: 'HEADWIND' | 'TAILWIND' | 'NEUTRAL';
  };
  btcDerivatives?: {
    fundingRate: number; // e.g. +0.0085%
    fundingApr: number; // e.g. +9.3%
    openInterestUsd: number; // e.g. $34.8B
    longLiquidations1h: number;
    shortLiquidations1h: number;
    squeezeRisk: 'LOW' | 'MODERATE' | 'SHORT_SQUEEZE_RISK' | 'LONG_SQUEEZE_RISK';
    sentiment: 'EXTREME_GREED' | 'GREED' | 'NEUTRAL' | 'FEAR' | 'EXTREME_FEAR';
  };
  goldMacro?: {
    realYield: number;
    goldSilverRatio: number;
    safeHavenFlow: 'STRONG_INFLOW' | 'STABLE' | 'OUTFLOW';
  };
  economicEvents: MacroEconomicEvent[];
}

export interface OrderBookLevel {
  price: number;
  amount: number;
  total: number;
  percent: number;
  ordersCount?: number;
  isIceberg?: boolean;
}

export interface TapeTrade {
  id: string;
  time: string;
  price: number;
  amount: number;
  side: 'buy' | 'sell';
  isBlockTrade?: boolean; // Whale trade
  usdValue?: number;
}

export interface Position {
  id: string;
  symbol: AssetSymbol;
  side: 'BUY' | 'SELL';
  product: ProductType;
  entryPrice: number;
  currentPrice: number;
  size: number; // BTC quantity or Gold lots
  lots?: number;
  leverage: number;
  margin: number;
  liquidationPrice: number;
  pnl: number;
  pnlPercent: number;
  roePercent?: number;
  stopLoss?: number;
  takeProfit?: number;
  tp1?: number;
  tp2?: number;
  tp3?: number;
  openTime: string;
  breakEvenActive?: boolean;
  trailingStopActive?: boolean;
}

export interface WorkingOrder {
  id: string;
  symbol: AssetSymbol;
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'TRAILING_STOP';
  product: ProductType;
  side: 'BUY' | 'SELL';
  price: number;
  triggerPrice?: number;
  size: number;
  lots?: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  status?: 'PENDING' | 'FILLED' | 'CANCELLED';
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
  leverage?: number;
  pnl: number;
  pnlPercent: number;
  fees?: number;
  netPnl?: number;
  entryTime: string;
  exitTime: string;
  setupName?: string;
  reason?: string;
  exitReason?: 'TP1' | 'TP2' | 'TP3' | 'SL' | 'MANUAL' | 'LIQUIDATION' | 'BE';
}

export interface InstitutionalSetup {
  asset: AssetSymbol;
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  setupName: string;
  confluenceScore: number; // 0 - 100%
  winProbability: number; // e.g. 84%
  riskRewardRatio: string; // e.g. "1:3.8"
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  recommendedSize: number; // e.g. 0.35 BTC or 1.25 Lots Gold
  riskAmountUsd: number; // e.g. $1,000 for 1% risk
  smcThesis: string;
  smcRationale?: string;
  keyConfluences: string[];
  invalidationRule: string;
  executionChecklist: string[];
  timestamp?: string;
}

export interface ConfluenceFactor {
  id?: string;
  category: 
    | 'STRUCTURE' 
    | 'ORDER_BLOCK' 
    | 'LIQUIDITY' 
    | 'CVD_ORDERFLOW' 
    | 'VWAP_BANDS' 
    | 'OTE_FIB' 
    | 'MACRO_DXY' 
    | 'KILLZONE'
    | 'SMC'
    | 'ORDER_FLOW'
    | 'MACRO_INTERMARKET'
    | 'TECHNICAL';
  name: string;
  value?: string;
  status: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  score?: number; // 0 - 100
  weight?: number;
  detail: string;
  institutionalSignificance?: string;
}

export interface BrokerConnection {
  isConnected: boolean;
  mode: 'LIVE' | 'SIMULATION';
  brokerType: 'BINANCE_FUTURES' | 'BYBIT' | 'METATRADER_MT5' | 'OANDA' | 'INSTITUTIONAL_DMA';
  brokerName: string;
  accountId: string;
  apiKeyMasked?: string;
  balance: number; // USD
  equity?: number;
  availableMargin: number;
  usedMargin: number;
  latencyMs: number;
  statusMessage: string;
}

export interface AccountStats {
  balance: number; // USD
  equity: number;
  marginUsed?: number;
  usedMargin?: number;
  freeMargin: number;
  marginLevel: number;
  realizedPnl: number;
  realizedPnL?: number;
  unrealizedPnL?: number;
  totalTrades: number;
  winCount?: number;
  lossCount?: number;
  winRate: number;
  profitFactor: number;
}
