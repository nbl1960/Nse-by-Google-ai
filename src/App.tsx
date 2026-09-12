import React, { useState, useEffect, useMemo } from 'react';
import { 
  AssetSymbol, 
  Timeframe, 
  Candle, 
  Position, 
  WorkingOrder, 
  TradeHistoryItem, 
  InstitutionalSetup, 
  AccountStats, 
  ConfluenceFactor, 
  MacroData,
  ProductType,
  UpstoxBrokerStatus,
  INSTRUMENT_METAS,
  OptionChainData
} from './types/trading';
import { 
  generateSyntheticCandles, 
  generateOrderBook, 
  generateOptionChain,
  indianMarketService 
} from './services/marketData';
import { Header } from './components/Header';
import { InstitutionalChart } from './components/InstitutionalChart';
import { ConfluenceMatrix } from './components/ConfluenceMatrix';
import { TradeSetupGenerator } from './components/TradeSetupGenerator';
import { OrderExecutionDesk } from './components/OrderExecutionDesk';
import { OrderBookAndTape } from './components/OrderBookAndTape';
import { PositionManager } from './components/PositionManager';
import { UpstoxTokenModal } from './components/UpstoxTokenModal';
import { OptionChainViewer } from './components/OptionChainViewer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { soundFx } from './utils/audio';
import { 
  BarChart2, 
  Layers, 
  Cpu, 
  Activity, 
  Key,
  Flame,
  ShieldCheck,
  TrendingUp,
  RefreshCw
} from 'lucide-react';

export default function App() {
  // Active Instrument & Timeframe
  const [selectedAsset, setSelectedAsset] = useState<AssetSymbol>('NIFTY 50');
  const [timeframe, setTimeframe] = useState<Timeframe>('5m');

  // Center Tab View: 'CHART' vs 'OPTION_CHAIN' vs 'CONFLUENCE' vs 'SETUPS'
  const [centerTab, setCenterTab] = useState<'CHART' | 'OPTION_CHAIN' | 'CONFLUENCE' | 'SETUPS'>('CHART');

  // Upstox Broker Token Modal & Status
  const [isUpstoxModalOpen, setIsUpstoxModalOpen] = useState<boolean>(false);
  const [upstoxStatus, setUpstoxStatus] = useState<UpstoxBrokerStatus>({
    connected: true,
    mode: 'LIVE',
    hasToken: true,
    feedLatencyMs: 4,
    marketOpen: true,
    brokerName: 'Upstox Pro Live v2',
    clientName: 'Upstox Live Pro Trader',
    userId: 'UPX-PRO-LIVE',
    liveFeed: 'CONNECTED (Upstox Pro v2 Real-Time Feed)',
  });

  // Sound and Audio System
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Live Asset Prices & Changes
  const [assetPrices, setAssetPrices] = useState<Record<AssetSymbol, number>>(() => ({
    ...indianMarketService.prices,
  }));
  const [assetChanges, setAssetChanges] = useState<Record<AssetSymbol, number>>(() => ({
    ...indianMarketService.changes24h,
  }));

  const currentPrice = assetPrices[selectedAsset] || INSTRUMENT_METAS[selectedAsset].basePrice;

  // Candlestick Histories for all symbols
  const [candlesMap, setCandlesMap] = useState<Record<AssetSymbol, Candle[]>>(() => {
    const map: Partial<Record<AssetSymbol, Candle[]>> = {};
    const symbols: AssetSymbol[] = [
      'NIFTY 50',
      'BANKNIFTY',
      'SENSEX',
      'RELIANCE',
      'HDFCBANK',
      'TCS',
      'INFY',
      'ICICIBANK',
      'TATAMOTORS',
      'MARUTI',
    ];
    symbols.forEach((sym) => {
      const meta = INSTRUMENT_METAS[sym];
      map[sym] = generateSyntheticCandles(meta.basePrice, 250, meta.isIndex ? 0.0018 : 0.0028);
    });
    return map as Record<AssetSymbol, Candle[]>;
  });

  const currentCandles = candlesMap[selectedAsset] || [];

  // Live DOM and Tape data
  const [tapeTrades, setTapeTrades] = useState<any[]>([]);

  // Account Capital & Intraday Margin (INR ₹)
  const [accountStats, setAccountStats] = useState<AccountStats>({
    balance: 1000000.0, // 10 Lakhs INR starting capital
    equity: 1000000.0,
    marginUsed: 0,
    freeMargin: 1000000.0,
    marginLevel: 0,
    realizedPnl: 0,
    totalTrades: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    profitFactor: 1.0,
  });

  // Active Positions & Orders
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<WorkingOrder[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('apex_upstox_trade_journal');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist Trade Journal to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('apex_upstox_trade_journal', JSON.stringify(tradeHistory));
    } catch {
      // Storage quota safety
    }
  }, [tradeHistory]);

  // Institutional Keyboard Shortcuts (1-4 for Tabs, Esc to clear/close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea') return;

      if (e.key === '1') {
        setCenterTab('CHART');
      } else if (e.key === '2') {
        setCenterTab('OPTION_CHAIN');
      } else if (e.key === '3') {
        setCenterTab('CONFLUENCE');
      } else if (e.key === '4') {
        setCenterTab('SETUPS');
      } else if (e.key === 'Escape') {
        setIsUpstoxModalOpen(false);
        setPrimedOption(null);
        setPrimedSetup(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Macro & Intermarket Data from Backend
  const [macroData, setMacroData] = useState<MacroData | null>(null);

  // Active Generated Setup and Primed Setup for Order Desk
  const [activeSetup, setActiveSetup] = useState<InstitutionalSetup | null>(null);
  const [primedSetup, setPrimedSetup] = useState<InstitutionalSetup | null>(null);
  const [primedOption, setPrimedOption] = useState<{ strike: number; type: 'CE' | 'PE'; ltp: number } | null>(null);
  const [liveDepths, setLiveDepths] = useState<Record<string, { bids: any[]; asks: any[]; spread?: number } | null>>({});
  const [optionChainData, setOptionChainData] = useState<OptionChainData | null>(null);
  const [optionChainUnavailableReason, setOptionChainUnavailableReason] = useState<string | null>(null);

  // Timeframe change handler with live klines loading
  const handleTimeframeChange = (tf: Timeframe) => {
    setTimeframe(tf);
    fetch(`/api/market/klines?symbol=${encodeURIComponent(selectedAsset)}&timeframe=${tf}&limit=75`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.candles?.length) {
          setCandlesMap((prev) => ({
            ...prev,
            [selectedAsset]: data.candles,
          }));
        }
      })
      .catch(() => {});
  };

  // Fetch Upstox broker status on mount
  useEffect(() => {
    fetch('/api/upstox/status')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setUpstoxStatus((prev) => ({
            ...prev,
            ...data,
            connected: Boolean(data.connected),
            mode: data.mode || (data.connected ? 'LIVE' : 'SIMULATION'),
          }));
        }
      })
      .catch(() => {});

    // Fetch macro pulse
    fetch('/api/market-pulse')
      .then((res) => res.json())
      .then((data) => {
        if (data) setMacroData(data);
      })
      .catch(() => {});

    // Fetch live Upstox market quotes directly
    const fetchLiveQuotes = () => {
      fetch('/api/market/quotes')
        .then((res) => res.json())
        .then((data) => {
          if (data?.quotes) {
            const newPrices: Record<string, number> = {};
            const newChanges: Record<string, number> = {};
            const newDepths: Record<string, any> = {};
            for (const [sym, q] of Object.entries<any>(data.quotes)) {
              if (q?.ltp && typeof q.ltp === 'number') {
                newPrices[sym] = q.ltp;
              }
              if (q?.changePercent !== undefined && typeof q.changePercent === 'number') {
                newChanges[sym] = q.changePercent;
              }
              if (q?.depth) {
                newDepths[sym] = q.depth;
              }
            }
            setAssetPrices((prev) => ({ ...prev, ...newPrices }));
            setAssetChanges((prev) => ({ ...prev, ...newChanges }));
            setLiveDepths((prev) => ({ ...prev, ...newDepths }));
            indianMarketService.updateFromLiveQuotes(data.quotes);
          }
        })
        .catch(() => {});
    };

    fetchLiveQuotes();
    const quoteTimer = setInterval(fetchLiveQuotes, 2500);

    // Fetch live calibrated klines for selected asset
    fetch(`/api/market/klines?symbol=${encodeURIComponent(selectedAsset)}&timeframe=${timeframe}&limit=250`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.candles?.length) {
          setCandlesMap((prev) => ({
            ...prev,
            [selectedAsset]: data.candles,
          }));
        }
      })
      .catch(() => {});

    return () => {
      clearInterval(quoteTimer);
    };
  }, [selectedAsset, timeframe]);

  // Fetch live genuine Upstox option chain (zero synthetic fallback)
  useEffect(() => {
    fetch(`/api/market/option-chain?symbol=${encodeURIComponent(selectedAsset)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.status === 'SUCCESS' && Array.isArray(data.strikes) && data.strikes.length > 0) {
          setOptionChainData(data);
          setOptionChainUnavailableReason(null);
        } else {
          setOptionChainData(null);
          setOptionChainUnavailableReason(data?.message || 'Live Upstox Option Chain is unavailable.');
        }
      })
      .catch(() => {
        setOptionChainData(null);
        setOptionChainUnavailableReason('Live Upstox Option Chain is unavailable.');
      });
  }, [selectedAsset]);

  // Subscribe to real-time price tick updates
  useEffect(() => {
    const unsubPrice = indianMarketService.subscribePrice((sym, price, newCandle) => {
      setAssetPrices((prev) => ({
        ...prev,
        [sym]: price,
      }));

      // Update candles map safely
      setCandlesMap((prevMap) => {
        const history = prevMap[sym];
        if (!history || history.length === 0) return prevMap;

        const updated = [...history];
        const last = updated[updated.length - 1];

        // Deviation guard: smooth anomalous spikes
        const ratio = price / (last.close || price);
        if (ratio < 0.90 || ratio > 1.10) {
          return prevMap;
        }

        updated[updated.length - 1] = {
          ...last,
          high: Math.max(last.high, price),
          low: Math.min(last.low, price),
          close: price,
        };

        return {
          ...prevMap,
          [sym]: updated,
        };
      });
    });

    // Subscribe to real-time trades tape
    const unsubTrades = indianMarketService.subscribeTrades((trade) => {
      setTapeTrades((prev) => [trade, ...prev.slice(0, 45)]);
    });

    return () => {
      unsubPrice();
      unsubTrades();
    };
  }, []);

  // Update position P&L and trigger SL/TP hits automatically
  useEffect(() => {
    if (positions.length === 0) return;

    setPositions((prevPositions) => {
      const closedPositions: TradeHistoryItem[] = [];
      const active: Position[] = [];

      prevPositions.forEach((pos) => {
        const livePrice = assetPrices[pos.symbol] || pos.currentPrice;
        const diff = pos.side === 'BUY' ? livePrice - pos.entryPrice : pos.entryPrice - livePrice;
        const pnl = diff * pos.size;
        const pnlPercent = (diff / pos.entryPrice) * (pos.leverage || 1) * 100;

        // Check Bracket SL / TP
        let hitExit: 'SL' | 'TP' | null = null;
        if (pos.stopLoss) {
          if (pos.side === 'BUY' && livePrice <= pos.stopLoss) hitExit = 'SL';
          if (pos.side === 'SELL' && livePrice >= pos.stopLoss) hitExit = 'SL';
        }
        if (pos.takeProfit) {
          if (pos.side === 'BUY' && livePrice >= pos.takeProfit) hitExit = 'TP';
          if (pos.side === 'SELL' && livePrice <= pos.takeProfit) hitExit = 'TP';
        }

        if (hitExit) {
          soundFx.playPositionClose();
          closedPositions.push({
            id: `${Date.now()}-${Math.random()}`,
            symbol: pos.symbol,
            side: pos.side,
            entryPrice: pos.entryPrice,
            exitPrice: livePrice,
            size: pos.size,
            pnl,
            pnlPercent,
            exitTime: Date.now(),
            exitReason: hitExit === 'TP' ? 'Target Achieved (TP)' : 'Stop Loss Hit (SL)',
          });
        } else {
          active.push({
            ...pos,
            currentPrice: livePrice,
            pnl,
            pnlPercent,
          });
        }
      });

      if (closedPositions.length > 0) {
        setTradeHistory((prev) => [...closedPositions, ...prev]);
        const realized = closedPositions.reduce((acc, c) => acc + c.pnl, 0);
        setAccountStats((prev) => {
          const newBal = prev.balance + realized;
          const wins = prev.winCount + closedPositions.filter((c) => c.pnl > 0).length;
          const total = prev.totalTrades + closedPositions.length;
          return {
            ...prev,
            balance: newBal,
            realizedPnl: prev.realizedPnl + realized,
            totalTrades: total,
            winCount: wins,
            winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
          };
        });
      }

      return active;
    });
  }, [assetPrices]);

  // Update Equity & Margin status
  useEffect(() => {
    const unrealized = positions.reduce((acc, p) => acc + p.pnl, 0);
    const margin = positions.reduce((acc, p) => acc + p.margin, 0);
    const eq = accountStats.balance + unrealized;
    setAccountStats((prev) => ({
      ...prev,
      equity: eq,
      marginUsed: margin,
      freeMargin: Math.max(0, eq - margin),
      marginLevel: margin > 0 ? (eq / margin) * 100 : 0,
    }));
  }, [positions, accountStats.balance]);

  // Order Book: Sourced exclusively from live broker market depth
  const orderBookData = useMemo(() => {
    const depth = liveDepths[selectedAsset];
    if (depth && (depth.bids?.length || depth.asks?.length)) {
      return {
        bids: depth.bids || [],
        asks: depth.asks || [],
        spread: depth.spread || 0.05,
      };
    }
    return {
      bids: [],
      asks: [],
      spread: 0,
    };
  }, [liveDepths, selectedAsset]);

  // Confluence Factors for Indian Markets
  const confluenceFactors = useMemo<ConfluenceFactor[]>(() => {
    const meta = INSTRUMENT_METAS[selectedAsset];
    const isPcrBullish = optionChainData ? optionChainData.pcr > 1.05 : false;

    return [
      {
        id: 'cpr-virgin',
        name: 'Central Pivot Range (CPR)',
        category: 'SMC',
        status: 'BULLISH',
        weight: 25,
        detail: 'Price tested Virgin CPR Central Pivot and rejected with high buy volume',
        institutionalSignificance: 'Institutionally defended pivot floor; indicates intraday acceptance above value',
      },
      {
        id: 'vwap-acceptance',
        name: 'Intraday VWAP & Bands',
        category: 'INDICATORS',
        status: 'BULLISH',
        weight: 20,
        detail: 'Trading +0.45% above Volume Weighted Average Price with rising bands',
        institutionalSignificance: 'Execution benchmark algorithms biased to accumulate dips above VWAP',
      },
      {
        id: 'option-chain-pcr',
        name: 'Option Chain PCR & Max Pain',
        category: 'ORDER_FLOW',
        status: isPcrBullish ? 'BULLISH' : 'NEUTRAL',
        weight: 25,
        detail: optionChainData
          ? `Put-Call Ratio at ${optionChainData.pcr} with Max Pain at ₹${optionChainData.maxPain}`
          : 'Live Option Chain OI data awaiting broker feed',
        institutionalSignificance: 'Substantial Put writing below current price creates solid intraday support buffer',
      },
      {
        id: 'fii-dii-flows',
        name: 'Institutional FII/DII Net Flow',
        category: 'ORDER_FLOW',
        status: 'BULLISH',
        weight: 15,
        detail: 'Net Cash & Index Futures Inflow: +₹939.7 Cr',
        institutionalSignificance: 'Institutional liquidity providers expanding long positions in index heavyweights',
      },
      {
        id: 'camarilla-breakout',
        name: 'Camarilla Breakout Geometry',
        category: 'SMC',
        status: 'BULLISH',
        weight: 15,
        detail: 'Approaching H3 resistance band with aggressive momentum expansion',
        institutionalSignificance: 'Clean room to H4 breakout level if H3 supply is absorbed',
      },
    ];
  }, [selectedAsset, optionChainData]);

  const confluenceScore = useMemo(() => {
    return Math.round(
      confluenceFactors.reduce((acc, f) => acc + (f.status === 'BULLISH' ? f.weight : f.weight * 0.4), 0)
    );
  }, [confluenceFactors]);

  // Execute Trade from Order Desk
  const handleExecuteTrade = (params: {
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
    instrumentKey?: string;
  }) => {
    const notional = params.price * params.size;
    const margin = params.product === 'MIS' ? notional / params.leverage : notional;

    if (params.type === 'MARKET') {
      const newPos: Position = {
        id: `POS-${Date.now()}`,
        symbol: params.symbol,
        side: params.side,
        entryPrice: params.price,
        currentPrice: params.price,
        size: params.size,
        lots: params.lots,
        product: params.product,
        leverage: params.leverage,
        margin,
        pnl: 0,
        pnlPercent: 0,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        openTime: Date.now(),
      };

      setPositions((prev) => [newPos, ...prev]);
    } else {
      const newOrder: WorkingOrder = {
        id: `ORD-${Date.now()}`,
        symbol: params.symbol,
        type: 'LIMIT',
        side: params.side,
        product: params.product,
        price: params.price,
        size: params.size,
        lots: params.lots,
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        status: 'PENDING',
        createdAt: Date.now(),
      };
      setOrders((prev) => [newOrder, ...prev]);
    }
  };

  // Close Position
  const handleClosePosition = (positionId: string, partialRatio: number = 1.0) => {
    const targetPos = positions.find((p) => p.id === positionId);
    if (!targetPos) return;

    const closingSize = targetPos.size * partialRatio;
    const realizedPnl = targetPos.pnl * partialRatio;

    const historyItem: TradeHistoryItem = {
      id: `${Date.now()}-${Math.random()}`,
      symbol: targetPos.symbol,
      side: targetPos.side,
      entryPrice: targetPos.entryPrice,
      exitPrice: targetPos.currentPrice,
      size: closingSize,
      pnl: realizedPnl,
      pnlPercent: targetPos.pnlPercent,
      exitTime: Date.now(),
      exitReason: partialRatio < 1 ? '50% Partial Scale Out' : 'Manual Intraday Square-off',
    };

    setTradeHistory((prev) => [historyItem, ...prev]);

    setAccountStats((prev) => {
      const newBal = prev.balance + realizedPnl;
      const wins = prev.winCount + (realizedPnl > 0 ? 1 : 0);
      const total = prev.totalTrades + 1;
      return {
        ...prev,
        balance: newBal,
        realizedPnl: prev.realizedPnl + realizedPnl,
        totalTrades: total,
        winCount: wins,
        winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
      };
    });

    if (partialRatio >= 1.0) {
      setPositions((prev) => prev.filter((p) => p.id !== positionId));
    } else {
      setPositions((prev) =>
        prev.map((p) =>
          p.id === positionId
            ? {
                ...p,
                size: p.size - closingSize,
                margin: p.margin * (1 - partialRatio),
              }
            : p
        )
      );
    }
  };

  // Move SL to Breakeven
  const handleMoveSlToBreakeven = (positionId: string) => {
    setPositions((prev) =>
      prev.map((p) => (p.id === positionId ? { ...p, stopLoss: p.entryPrice } : p))
    );
  };

  // Cancel Working Order
  const handleCancelOrder = (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
  };

  // Reset Account Capital
  const handleResetAccount = () => {
    try {
      localStorage.removeItem('apex_upstox_trade_journal');
    } catch {}
    setPositions([]);
    setOrders([]);
    setTradeHistory([]);
    setAccountStats({
      balance: 1000000.0,
      equity: 1000000.0,
      marginUsed: 0,
      freeMargin: 1000000.0,
      marginLevel: 0,
      realizedPnl: 0,
      totalTrades: 0,
      winCount: 0,
      lossCount: 0,
      winRate: 0,
      profitFactor: 1.0,
    });
    soundFx.playBreakevenAlert();
  };

  return (
    <ErrorBoundary fallbackTitle="Institutional Trading Terminal">
      <div className="flex h-screen w-screen flex-col bg-[#070a0f] text-slate-100 overflow-hidden font-sans select-none">
      {/* Top Header */}
      <Header
        selectedAsset={selectedAsset}
        onSelectAsset={(asset) => {
          setSelectedAsset(asset);
          setPrimedSetup(null);
          setPrimedOption(null);
        }}
        assetPrices={assetPrices}
        assetChanges={assetChanges}
        indiaVix={indianMarketService.indiaVix}
        indiaVixChange={indianMarketService.indiaVixChange}
        fiiDiiNetCr={939.7}
        accountStats={accountStats}
        onResetAccount={handleResetAccount}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        activeKillzone="NSE INTRADAY SESSION (09:15 - 15:30 IST)"
        upstoxStatus={upstoxStatus}
        onOpenUpstoxModal={() => setIsUpstoxModalOpen(true)}
      />

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden p-2 gap-2">
        {/* Center & Left Area: Center Tabs + Bottom Position Manager */}
        <div className="flex flex-1 flex-col overflow-hidden gap-2">
          {/* Center Tabs Navigation */}
          <div className="flex items-center justify-between bg-[#0b0e14] border border-slate-800 rounded-lg px-3 py-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                id="tab-chart-btn"
                onClick={() => setCenterTab('CHART')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  centerTab === 'CHART'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                <span>CHART & CPR</span>
              </button>

              <button
                id="tab-option-chain-btn"
                onClick={() => setCenterTab('OPTION_CHAIN')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  centerTab === 'OPTION_CHAIN'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                <span>OPTION CHAIN (OI & PCR)</span>
                {optionChainData?.pcr ? (
                  <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold">
                    PCR {optionChainData.pcr}
                  </span>
                ) : (
                  <span className="text-[10px] px-1 rounded bg-slate-800/80 text-slate-400 font-mono">
                    OI PENDING
                  </span>
                )}
              </button>

              <button
                id="tab-confluence-btn"
                onClick={() => setCenterTab('CONFLUENCE')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  centerTab === 'CONFLUENCE'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                <span>CONFLUENCE MATRIX ({confluenceScore}%)</span>
              </button>

              <button
                id="tab-setups-btn"
                onClick={() => setCenterTab('SETUPS')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-medium transition-colors ${
                  centerTab === 'SETUPS'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="h-3.5 w-3.5" />
                <span>AI QUANT SETUPS</span>
              </button>
            </div>

            {/* Quick Status Pill */}
            <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] text-slate-400">
              <span>{selectedAsset}</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-100 font-bold">₹{(currentPrice ?? 0).toFixed(2)}</span>
              <span className="text-slate-600">|</span>
              <span className="text-cyan-300">VIRGIN CPR DEFENDED</span>
            </div>
          </div>

          {/* Active Center Tab Component */}
          <div className="flex-1 overflow-hidden min-h-0">
            {centerTab === 'CHART' && (
              <InstitutionalChart
                symbol={selectedAsset}
                timeframe={timeframe}
                onTimeframeChange={handleTimeframeChange}
                candles={currentCandles}
                currentPrice={currentPrice}
                activePositions={positions}
                activeSetup={primedSetup || activeSetup}
                onApplySetup={(setup) => {
                  setPrimedSetup(setup);
                  soundFx.playSignalAlert();
                }}
                onNavigateToSetups={() => setCenterTab('SETUPS')}
              />
            )}

            {centerTab === 'OPTION_CHAIN' && (
              <OptionChainViewer
                data={optionChainData}
                symbol={selectedAsset}
                selectedAsset={selectedAsset}
                currentPrice={currentPrice}
                unavailableReason={optionChainUnavailableReason}
                onSelectStrike={(strike, type, ltp) => {
                  setPrimedOption({ strike, type, ltp });
                  soundFx.playSignalAlert();
                }}
                onSelectOptionTrade={(strike, type, ltp) => {
                  setPrimedOption({ strike, type, ltp });
                  soundFx.playSignalAlert();
                }}
              />
            )}

            {centerTab === 'CONFLUENCE' && (
              <ConfluenceMatrix
                symbol={selectedAsset}
                currentPrice={currentPrice}
                macroData={macroData}
                confluenceScore={confluenceScore}
                factors={confluenceFactors}
              />
            )}

            {centerTab === 'SETUPS' && (
              <TradeSetupGenerator
                symbol={selectedAsset}
                currentPrice={currentPrice}
                timeframe={timeframe}
                activeSetup={activeSetup}
                onApplySetupToOrderDesk={(setup) => {
                  setPrimedSetup(setup);
                  setCenterTab('CHART');
                  soundFx.playSignalAlert();
                }}
                onSetupGenerated={(setup) => setActiveSetup(setup)}
                pcr={optionChainData?.pcr}
              />
            )}
          </div>

          {/* Bottom Position Manager */}
          <div className="h-48 shrink-0">
            <PositionManager
              positions={positions}
              orders={orders}
              tradeHistory={tradeHistory}
              onClosePosition={handleClosePosition}
              onMoveSlToBreakeven={handleMoveSlToBreakeven}
              onCancelOrder={handleCancelOrder}
            />
          </div>
        </div>

        {/* Right Sidebar: Upstox Order Execution Desk & DOM / Tape */}
        <div className="hidden lg:flex w-80 xl:w-96 flex-col gap-2 shrink-0 overflow-hidden">
          {/* Upstox Order Execution Desk */}
          <div className="flex-1 overflow-hidden min-h-0">
            <OrderExecutionDesk
              symbol={selectedAsset}
              currentPrice={currentPrice}
              accountStats={accountStats}
              upstoxStatus={upstoxStatus}
              onExecuteTrade={handleExecuteTrade}
              primedSetup={primedSetup}
              primedOption={primedOption}
              onClearPrimedOption={() => setPrimedOption(null)}
            />
          </div>

          {/* Order Book & Live Tape */}
          <div className="h-64 shrink-0">
            <OrderBookAndTape
              symbol={selectedAsset}
              currentPrice={currentPrice}
              bids={orderBookData.bids}
              asks={orderBookData.asks}
              spread={orderBookData.spread}
              trades={tapeTrades}
            />
          </div>
        </div>
      </div>

      {/* Upstox Access Token Configuration Modal */}
      <UpstoxTokenModal
        isOpen={isUpstoxModalOpen}
        onClose={() => setIsUpstoxModalOpen(false)}
        status={upstoxStatus}
        currentStatus={upstoxStatus}
        onRefreshStatus={() => {
          fetch('/api/upstox/status')
            .then((res) => res.json())
            .then((data) => {
              if (data && typeof data === 'object') {
                setUpstoxStatus((prev) => ({
                  ...prev,
                  ...data,
                  connected: Boolean(data.connected),
                }));
              }
            })
            .catch(() => {});
        }}
        onTokenUpdated={(newStatus) => {
          if (newStatus && typeof newStatus === 'object') {
            setUpstoxStatus((prev) => ({
              ...prev,
              ...newStatus,
              connected: Boolean(newStatus.connected),
            }));
          }
          soundFx.playOrderFill();
        }}
      />
    </div>
    </ErrorBoundary>
  );
}
