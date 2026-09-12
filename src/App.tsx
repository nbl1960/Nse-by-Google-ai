import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  AssetSymbol, 
  PrimaryTradeSymbol,
  Timeframe, 
  Candle, 
  Position, 
  WorkingOrder, 
  TradeHistoryItem, 
  InstitutionalSetup, 
  AccountStats, 
  ConfluenceFactor, 
  MacroIntermarketData,
  ProductType,
  BrokerConnection,
  INSTRUMENT_METAS,
  OrderBookLevel,
  TapeTrade,
  KillzoneInfo
} from './types/trading';
import { 
  generateSyntheticCandles, 
  generateOrderBook, 
  generateInitialTape,
  institutionalMarketService,
  SAMPLE_ECONOMIC_EVENTS
} from './services/marketData';
import { Header } from './components/Header';
import { InstitutionalChart } from './components/InstitutionalChart';
import { ConfluenceMatrix } from './components/ConfluenceMatrix';
import { TradeSetupGenerator } from './components/TradeSetupGenerator';
import { OrderExecutionDesk } from './components/OrderExecutionDesk';
import { OrderBookAndTape } from './components/OrderBookAndTape';
import { PositionManager } from './components/PositionManager';
import { OptionChainViewer } from './components/OptionChainViewer';
import { BrokerConnectionModal } from './components/BrokerConnectionModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { soundFx } from './utils/audio';
import { 
  BarChart2, 
  Layers, 
  Cpu, 
  Activity, 
  Radio, 
  Flame, 
  ShieldCheck, 
  TrendingUp, 
  TrendingDown, 
  Globe,
  Clock,
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function App() {
  // Primary Selected Asset ('BTC/USD' or 'XAU/USD')
  const [selectedAsset, setSelectedAsset] = useState<PrimaryTradeSymbol>('BTC/USD');
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');

  // Center Tab View
  const [centerTab, setCenterTab] = useState<'CHART' | 'DERIVATIVES' | 'CONFLUENCE' | 'SETUPS' | 'CALENDAR'>('CHART');

  // Broker Connection State
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState<boolean>(false);
  const [brokerConfig, setBrokerConfig] = useState<BrokerConnection>({
    isConnected: true,
    mode: 'LIVE',
    brokerType: 'BINANCE_FUTURES',
    brokerName: 'Binance Institutional Futures v3',
    accountId: 'BIN-INST-9942',
    apiKeyMasked: 'vm8k...49xQ',
    balance: 100000.0,
    availableMargin: 87500.0,
    usedMargin: 12500.0,
    latencyMs: 3,
    statusMessage: 'Connected to Tokyo AWS DMA Cross-Connect',
  });

  // Sound FX toggle
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Live Prices & 24h Changes
  const [assetPrices, setAssetPrices] = useState<Record<AssetSymbol, number>>(() => ({
    ...institutionalMarketService.prices,
  }));
  const [assetChanges, setAssetChanges] = useState<Record<AssetSymbol, number>>(() => ({
    ...institutionalMarketService.changes24h,
  }));

  const currentPrice = assetPrices[selectedAsset] || INSTRUMENT_METAS[selectedAsset].basePrice;

  // Candlestick Histories for BTC & Gold
  const [candlesMap, setCandlesMap] = useState<Record<AssetSymbol, Candle[]>>(() => {
    const map: Partial<Record<AssetSymbol, Candle[]>> = {};
    const symbols: AssetSymbol[] = ['BTC/USD', 'XAU/USD', 'DXY', 'ETH/USD', 'US10Y', 'XAG/USD'];
    symbols.forEach((sym) => {
      const meta = INSTRUMENT_METAS[sym] || INSTRUMENT_METAS['BTC/USD'];
      map[sym] = generateSyntheticCandles(meta.basePrice, 220, sym === 'BTC/USD' ? 0.0022 : 0.0014);
    });
    return map as Record<AssetSymbol, Candle[]>;
  });

  // Active Candlestick series for selected asset
  const activeCandles = candlesMap[selectedAsset] || [];

  // Order Book and Tape
  const [orderBook, setOrderBook] = useState(() => generateOrderBook(currentPrice, selectedAsset, 8));
  const [tapeTrades, setTapeTrades] = useState<TapeTrade[]>(() => generateInitialTape(currentPrice, selectedAsset, 18));

  // Account State ($100,000 baseline)
  const [accountStats, setAccountStats] = useState<AccountStats>({
    balance: 100000.0,
    equity: 100000.0,
    freeMargin: 87500.0,
    usedMargin: 12500.0,
    marginLevel: 800.0,
    realizedPnL: 0.0,
    unrealizedPnL: 0.0,
    winRate: 75.0,
    profitFactor: 2.8,
    totalTrades: 12,
  });

  // Active Positions, Working Orders & History
  const [positions, setPositions] = useState<Position[]>([
    {
      id: 'POS-BTC-1',
      symbol: 'BTC/USD',
      side: 'BUY',
      product: 'PERPETUAL_SWAP',
      entryPrice: 63840.0,
      currentPrice: 64850.0,
      size: 0.5,
      lots: 0.5,
      margin: 3192.0,
      leverage: 10,
      liquidationPrice: 57800.0,
      stopLoss: 63200.0,
      takeProfit: 66500.0,
      pnl: 505.0,
      pnlPercent: 15.8,
      openTime: new Date(Date.now() - 3600 * 1000 * 3).toLocaleTimeString(),
    },
  ]);

  const [workingOrders, setWorkingOrders] = useState<WorkingOrder[]>([
    {
      id: 'ORD-LMT-901',
      symbol: 'XAU/USD',
      side: 'BUY',
      type: 'LIMIT',
      product: 'PERPETUAL_SWAP',
      price: 2634.50,
      size: 1.0,
      lots: 1.0,
      leverage: 20,
      stopLoss: 2628.00,
      takeProfit: 2655.00,
      timestamp: new Date(Date.now() - 1800 * 1000).toLocaleTimeString(),
    },
  ]);

  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([
    {
      id: 'HIST-1',
      symbol: 'BTC/USD',
      side: 'BUY',
      entryPrice: 62900.0,
      exitPrice: 64200.0,
      size: 0.5,
      pnl: 650.0,
      pnlPercent: 20.6,
      entryTime: '08:15:20',
      exitTime: '11:42:10',
      reason: 'TP2 Hit (15m Bullish OB Expansion)',
    },
    {
      id: 'HIST-2',
      symbol: 'XAU/USD',
      side: 'BUY',
      entryPrice: 2618.0,
      exitPrice: 2634.5,
      size: 1.5,
      pnl: 2475.0,
      pnlPercent: 31.5,
      entryTime: 'Yesterday 13:00:15',
      exitTime: 'Yesterday 15:30:45',
      reason: 'TP3 Hit (London Low Sweep + DXY Rejection)',
    },
  ]);

  // Active Institutional Setup
  const [activeSetup, setActiveSetup] = useState<InstitutionalSetup | null>(null);

  // ICT Killzone State calculation
  const killzoneInfo: KillzoneInfo = useMemo(() => {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMins = now.getUTCMinutes();
    const currentMins = utcHours * 60 + utcMins;

    // London Open: 07:00 - 10:00 UTC (420 to 600)
    // NY Open: 12:30 - 16:00 UTC (750 to 960)
    // London Close: 15:00 - 17:00 UTC (900 to 1020)
    // Asian Range: 00:00 - 06:00 UTC (0 to 360)
    if (currentMins >= 750 && currentMins <= 960) {
      const left = 960 - currentMins;
      return {
        activeZone: 'NY_OPEN',
        label: 'NEW YORK OPEN KILLZONE',
        timeRemaining: `${Math.floor(left / 60)}h ${left % 60}m remaining`,
        manipulationState: 'JUDAS SWING EXPANSION',
        description: 'Peak institutional intraday liquidity injection and trend continuation.',
      };
    } else if (currentMins >= 420 && currentMins <= 600) {
      const left = 600 - currentMins;
      return {
        activeZone: 'LONDON_OPEN',
        label: 'LONDON OPEN KILLZONE',
        timeRemaining: `${Math.floor(left / 60)}h ${left % 60}m remaining`,
        manipulationState: 'ASIAN RANGE HIGH/LOW PURGE',
        description: 'Smart Money clearing retail stops before true daily displacement.',
      };
    } else if (currentMins >= 0 && currentMins <= 360) {
      const left = 360 - currentMins;
      return {
        activeZone: 'ASIAN_RANGE',
        label: 'ASIAN CONSOLIDATION RANGE',
        timeRemaining: `${Math.floor(left / 60)}h ${left % 60}m remaining`,
        manipulationState: 'LIQUIDITY ACCUMULATION',
        description: 'Establishes the Asian High and Low liquidity boundaries.',
      };
    }

    return {
      activeZone: 'LONDON_CLOSE',
      label: 'LONDON CLOSE / NY CONTINUATION',
      timeRemaining: 'Active session',
      manipulationState: 'PROFIT TAKING & RUNNERS',
      description: 'Institutional book squaring and continuation into daily settlement.',
    };
  }, []);

  // Fetch initial quotes and broker info from backend
  useEffect(() => {
    fetch('/api/broker/status')
      .then((r) => r.json())
      .then((data) => {
        if (data) setBrokerConfig((prev) => ({ ...prev, ...data }));
      })
      .catch(() => {});

    fetch(`/api/market/klines?symbol=${selectedAsset}&timeframe=${timeframe}&limit=160`)
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.candles) && data.candles.length > 0) {
          setCandlesMap((prev) => ({
            ...prev,
            [selectedAsset]: data.candles,
          }));
        }
      })
      .catch(() => {});
  }, [selectedAsset, timeframe]);

  // Subscribe to Live Market Feed (Binance WebSocket + Micro-Tick Engine)
  useEffect(() => {
    const unsubscribe = institutionalMarketService.subscribe((prices, changes) => {
      setAssetPrices(prices);
      setAssetChanges(changes);

      // Update current live candle close and high/low
      const activeP = prices[selectedAsset];
      if (typeof activeP === 'number' && activeP > 0) {
        setCandlesMap((prevMap) => {
          const currentList = prevMap[selectedAsset] || [];
          if (currentList.length === 0) return prevMap;
          const lastCandle = currentList[currentList.length - 1];
          const updatedLast: Candle = {
            ...lastCandle,
            close: activeP,
            high: Math.max(lastCandle.high, activeP),
            low: Math.min(lastCandle.low, activeP),
            volume: lastCandle.volume + Math.floor(Math.random() * 5 + 1),
          };
          return {
            ...prevMap,
            [selectedAsset]: [...currentList.slice(0, -1), updatedLast],
          };
        });

        // Update Position PnL in real-time
        setPositions((prevPositions) => {
          return prevPositions.map((pos) => {
            const markPrice = prices[pos.symbol] || pos.currentPrice;
            const diff = pos.side === 'BUY' ? markPrice - pos.entryPrice : pos.entryPrice - markPrice;
            const multiplier = pos.symbol === 'XAU/USD' ? 100 : 1;
            const pnl = Number((diff * pos.size * multiplier).toFixed(2));
            const pnlPercent = Number(((pnl / Math.max(1, pos.margin)) * 100).toFixed(2));
            return {
              ...pos,
              currentPrice: markPrice,
              pnl,
              pnlPercent,
            };
          });
        });
      }
    });

    return () => unsubscribe();
  }, [selectedAsset]);

  // Periodic updates for DOM Order Book and Tape
  useEffect(() => {
    const domTimer = setInterval(() => {
      const p = assetPrices[selectedAsset] || INSTRUMENT_METAS[selectedAsset].basePrice;
      setOrderBook(generateOrderBook(p, selectedAsset, 8));

      // Append new trade to Tape
      const isBuy = Math.random() > 0.48;
      const delta = (Math.random() - 0.5) * (selectedAsset === 'BTC/USD' ? 3.5 : 0.35);
      const tradePrice = Number((p + delta).toFixed(2));
      const isBlock = Math.random() > 0.85;
      const amt = selectedAsset === 'BTC/USD' 
        ? Number(((Math.random() * 1.2 + 0.1) * (isBlock ? 6 : 1)).toFixed(3))
        : Number(((Math.random() * 12 + 1) * (isBlock ? 8 : 1)).toFixed(1));
      const val = Math.round(tradePrice * amt * (selectedAsset === 'XAU/USD' ? 100 : 1));

      const newTrade: TapeTrade = {
        id: `TR-${Date.now()}`,
        time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        price: tradePrice,
        amount: amt,
        side: isBuy ? 'buy' : 'sell',
        isBlockTrade: isBlock,
        usdValue: val,
      };

      setTapeTrades((prev) => [newTrade, ...prev.slice(0, 35)]);
    }, 1200);

    return () => clearInterval(domTimer);
  }, [selectedAsset, assetPrices]);

  // Update Account Equity when positions fluctuate
  useEffect(() => {
    const unrealized = positions.reduce((acc, p) => acc + p.pnl, 0);
    const usedMargin = positions.reduce((acc, p) => acc + p.margin, 0);
    const equity = Number((accountStats.balance + unrealized).toFixed(2));
    const freeMargin = Math.max(0, Number((equity - usedMargin).toFixed(2)));
    const marginLevel = usedMargin > 0 ? Number(((equity / usedMargin) * 100).toFixed(1)) : 999.0;

    setAccountStats((prev) => ({
      ...prev,
      equity,
      freeMargin,
      usedMargin,
      marginLevel,
      unrealizedPnL: unrealized,
    }));
  }, [positions, accountStats.balance]);

  // Trade Execution Handlers
  const handleExecuteTrade = useCallback((params: {
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
  }) => {
    const notional = params.size * params.price * (params.symbol === 'XAU/USD' ? 100 : 1);
    const margin = Number((notional / params.leverage).toFixed(2));
    const isBuy = params.side === 'BUY';
    const liqDistance = (params.price * 0.9) / params.leverage;
    const liquidationPrice = Number((isBuy ? params.price - liqDistance : params.price + liqDistance).toFixed(2));

    if (params.type === 'LIMIT') {
      const newOrder: WorkingOrder = {
        id: `ORD-LMT-${Date.now().toString().slice(-4)}`,
        symbol: params.symbol,
        side: params.side,
        type: 'LIMIT',
        product: params.product,
        price: params.price,
        size: params.size,
        lots: params.lots,
        leverage: params.leverage,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        timestamp: new Date().toLocaleTimeString(),
      };
      setWorkingOrders((prev) => [newOrder, ...prev]);
    } else {
      const newPos: Position = {
        id: `POS-${Date.now().toString().slice(-4)}`,
        symbol: params.symbol,
        side: params.side,
        product: params.product,
        entryPrice: params.price,
        currentPrice: params.price,
        size: params.size,
        lots: params.lots,
        margin,
        leverage: params.leverage,
        liquidationPrice,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        pnl: 0,
        pnlPercent: 0,
        openTime: new Date().toLocaleTimeString(),
      };
      setPositions((prev) => [newPos, ...prev]);
    }
  }, []);

  const handleClosePosition = useCallback((positionId: string, partialRatio: number = 1.0) => {
    setPositions((prev) => {
      const pos = prev.find((p) => p.id === positionId);
      if (!pos) return prev;

      const closingSize = Number((pos.size * partialRatio).toFixed(2));
      const closingPnl = Number((pos.pnl * partialRatio).toFixed(2));

      // Record to Trade Journal
      const journalItem: TradeHistoryItem = {
        id: `HIST-${Date.now().toString().slice(-4)}`,
        symbol: pos.symbol,
        side: pos.side,
        entryPrice: pos.entryPrice,
        exitPrice: pos.currentPrice,
        size: closingSize,
        pnl: closingPnl,
        pnlPercent: pos.pnlPercent,
        entryTime: pos.openTime,
        exitTime: new Date().toLocaleTimeString(),
        reason: partialRatio < 1 ? 'Partial Profit Scale-Out (50%)' : 'Manual Market Flatten',
      };
      setTradeHistory((hist) => [journalItem, ...hist]);

      // Update account balance
      setAccountStats((prevStats) => ({
        ...prevStats,
        balance: Number((prevStats.balance + closingPnl).toFixed(2)),
        realizedPnL: Number((prevStats.realizedPnL + closingPnl).toFixed(2)),
      }));

      if (partialRatio >= 1.0) {
        return prev.filter((p) => p.id !== positionId);
      } else {
        return prev.map((p) => {
          if (p.id !== positionId) return p;
          return {
            ...p,
            size: Number((p.size - closingSize).toFixed(2)),
            margin: Number((p.margin * (1 - partialRatio)).toFixed(2)),
            pnl: Number((p.pnl * (1 - partialRatio)).toFixed(2)),
          };
        });
      }
    });
  }, []);

  const handleMoveSlToBreakeven = useCallback((positionId: string) => {
    setPositions((prev) =>
      prev.map((p) => {
        if (p.id !== positionId) return p;
        return {
          ...p,
          stopLoss: p.entryPrice,
        };
      })
    );
  }, []);

  const handleCancelOrder = useCallback((orderId: string) => {
    setWorkingOrders((prev) => prev.filter((o) => o.id !== orderId));
  }, []);

  const handleResetAccount = useCallback(() => {
    setPositions([]);
    setWorkingOrders([]);
    setAccountStats({
      balance: 100000.0,
      equity: 100000.0,
      freeMargin: 87500.0,
      usedMargin: 12500.0,
      marginLevel: 800.0,
      realizedPnL: 0.0,
      unrealizedPnL: 0.0,
      winRate: 75.0,
      profitFactor: 2.8,
      totalTrades: 0,
    });
  }, []);

  // Compute Confluence Factors for ConfluenceMatrix
  const confluenceFactors: ConfluenceFactor[] = useMemo(() => {
    const isGold = selectedAsset === 'XAU/USD';
    return [
      {
        category: 'SMC',
        name: 'Market Structure & Liquidity',
        value: isGold ? 'Asian Low Swept + 15m Bullish OB Mitigation' : 'Bullish MSS above $64,200 Asian High',
        status: 'BULLISH',
        detail: isGold ? 'Sell-side liquidity grabbed into institutional order block at $2634' : 'Displacement created unmitigated Fair Value Gap',
      },
      {
        category: 'SMC',
        name: 'Premium / Discount & Fibs',
        value: 'Optimal Trade Entry (0.705 OTE)',
        status: 'BULLISH',
        detail: 'Price deeply in discount zone relative to high-timeframe 4h range',
      },
      {
        category: 'ORDER_FLOW',
        name: 'Cumulative Volume Delta (CVD)',
        value: '+480 Delta (Bullish Absorption)',
        status: 'BULLISH',
        detail: 'Aggressive institutional market buying absorbing passive limit offers',
      },
      {
        category: 'ORDER_FLOW',
        name: 'Volume Profile (Fixed Range)',
        value: 'Holding Above Developing POC & VAL',
        status: 'BULLISH',
        detail: 'Point of Control migration upward confirms institutional value acceptance',
      },
      {
        category: 'MACRO_INTERMARKET',
        name: 'DXY Dollar Index Failure',
        value: 'DXY 101.45 (-0.32% Rejection)',
        status: 'BULLISH',
        detail: 'Inverse Dollar drop provides strong tailwind for Gold & Bitcoin',
      },
      {
        category: 'MACRO_INTERMARKET',
        name: 'Derivatives Leverage & Liquidations',
        value: isGold ? 'Real Yields Easing (-3 bps)' : 'Funding +0.0084% (Short Squeeze Fuel)',
        status: 'BULLISH',
        detail: isGold ? 'Yield pullbacks fuel physical bullion inflows' : '$18.6M short liquidation wall ready to trigger at highs',
      },
    ];
  }, [selectedAsset]);

  const confluenceScore = 92;

  return (
    <ErrorBoundary>
      <div className="flex flex-col min-h-screen bg-[#080b11] text-slate-200 font-sans">
        {/* Terminal Header */}
        <Header
          selectedAsset={selectedAsset}
          onSelectAsset={setSelectedAsset}
          assetPrices={assetPrices}
          assetChanges={assetChanges}
          accountStats={accountStats}
          onResetAccount={handleResetAccount}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          killzoneInfo={killzoneInfo}
          brokerConfig={brokerConfig}
          onOpenBrokerModal={() => setIsBrokerModalOpen(true)}
        />

        {/* Main Terminal Workspace Layout */}
        <main className="flex-1 p-3 space-y-3 max-w-[1720px] mx-auto w-full">
          {/* Top Center Navigation Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
            <div className="flex items-center gap-1 bg-[#0c1018] p-1 rounded-lg border border-slate-800">
              <button
                id="tab-chart"
                onClick={() => setCenterTab('CHART')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-bold transition-all cursor-pointer ${
                  centerTab === 'CHART'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                <span>INSTITUTIONAL CHART</span>
              </button>

              <button
                id="tab-derivatives"
                onClick={() => setCenterTab('DERIVATIVES')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-bold transition-all cursor-pointer ${
                  centerTab === 'DERIVATIVES'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>DERIVATIVES & GEX</span>
              </button>

              <button
                id="tab-confluence"
                onClick={() => setCenterTab('CONFLUENCE')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-bold transition-all cursor-pointer ${
                  centerTab === 'CONFLUENCE'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>CONFLUENCE MATRIX (92%)</span>
              </button>

              <button
                id="tab-setups"
                onClick={() => setCenterTab('SETUPS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-bold transition-all cursor-pointer ${
                  centerTab === 'SETUPS'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Cpu className="h-3.5 w-3.5" />
                <span>QUANT A+ SETUPS</span>
              </button>

              <button
                id="tab-calendar"
                onClick={() => setCenterTab('CALENDAR')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-bold transition-all cursor-pointer ${
                  centerTab === 'CALENDAR'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>MACRO CALENDAR (NFP/FOMC)</span>
              </button>
            </div>

            {/* Quick Live Ticker Pill */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">ACTIVE FEED:</span>
              <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                {selectedAsset} @ ${currentPrice.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Core Grid: Chart / Matrix on Left, Order Desk & DOM on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Left Main Viewport (Col 8) */}
            <div className="lg:col-span-8 flex flex-col space-y-3">
              {centerTab === 'CHART' && (
                <InstitutionalChart
                  candles={activeCandles}
                  symbol={selectedAsset}
                  currentPrice={currentPrice}
                  timeframe={timeframe}
                  onTimeframeChange={setTimeframe}
                  activePositions={positions}
                  activeSetup={activeSetup}
                  onApplySetup={(setup) => setActiveSetup(setup)}
                  onNavigateToSetups={() => setCenterTab('SETUPS')}
                />
              )}

              {centerTab === 'DERIVATIVES' && (
                <OptionChainViewer
                  selectedAsset={selectedAsset}
                  currentPrice={currentPrice}
                />
              )}

              {centerTab === 'CONFLUENCE' && (
                <div className="h-[540px]">
                  <ConfluenceMatrix
                    symbol={selectedAsset}
                    currentPrice={currentPrice}
                    macroData={null}
                    confluenceScore={confluenceScore}
                    factors={confluenceFactors}
                    killzoneInfo={killzoneInfo}
                  />
                </div>
              )}

              {centerTab === 'SETUPS' && (
                <TradeSetupGenerator
                  symbol={selectedAsset}
                  currentPrice={currentPrice}
                  timeframe={timeframe}
                  activeSetup={activeSetup}
                  onApplySetupToOrderDesk={(setup) => setActiveSetup(setup)}
                  onSetupGenerated={(setup) => setActiveSetup(setup)}
                />
              )}

              {centerTab === 'CALENDAR' && (
                <div className="p-4 rounded-lg bg-[#0b0e14] border border-slate-800 space-y-3 font-mono text-xs select-none">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-amber-400" />
                      <span className="font-bold text-slate-100 uppercase">
                        HIGH-IMPACT ECONOMIC RELEASES & FED WATCH
                      </span>
                    </div>
                    <span className="text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">
                      RED FOLDER VOLATILITY WARNING
                    </span>
                  </div>

                  <div className="space-y-2">
                    {SAMPLE_ECONOMIC_EVENTS.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 rounded bg-[#0e1420] border border-slate-800 flex flex-wrap items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                            {ev.impact}
                          </span>
                          <div>
                            <div className="font-bold text-slate-200">{ev.event}</div>
                            <div className="text-[10px] text-slate-500">
                              Time: {ev.time} • Currency: {ev.currency}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <span className="text-[9px] text-slate-500 block uppercase">FORECAST / PREV</span>
                            <span className="text-slate-300 font-semibold">{ev.forecast}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-500 block uppercase">COUNTDOWN</span>
                            <span className="text-amber-400 font-bold">{ev.countdown}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Position Manager & Trade Journal */}
              <PositionManager
                positions={positions}
                orders={workingOrders}
                tradeHistory={tradeHistory}
                onClosePosition={handleClosePosition}
                onMoveSlToBreakeven={handleMoveSlToBreakeven}
                onCancelOrder={handleCancelOrder}
              />
            </div>

            {/* Right Execution & DOM Desk (Col 4) */}
            <div className="lg:col-span-4 flex flex-col space-y-3">
              {/* Order Execution Desk */}
              <OrderExecutionDesk
                symbol={selectedAsset}
                currentPrice={currentPrice}
                accountStats={accountStats}
                brokerConfig={brokerConfig}
                onExecuteTrade={handleExecuteTrade}
                primedSetup={activeSetup}
              />

              {/* Order Book & Time & Sales Tape */}
              <div className="h-[390px]">
                <OrderBookAndTape
                  symbol={selectedAsset}
                  currentPrice={currentPrice}
                  bids={orderBook.bids}
                  asks={orderBook.asks}
                  spread={orderBook.spread}
                  trades={tapeTrades}
                />
              </div>
            </div>
          </div>
        </main>

        {/* Broker Connectivity Modal */}
        <BrokerConnectionModal
          isOpen={isBrokerModalOpen}
          onClose={() => setIsBrokerModalOpen(false)}
          brokerConfig={brokerConfig}
          onUpdateBroker={(updated) => setBrokerConfig((prev) => ({ ...prev, ...updated }))}
        />
      </div>
    </ErrorBoundary>
  );
}
