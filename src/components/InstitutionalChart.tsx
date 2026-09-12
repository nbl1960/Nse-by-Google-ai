import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Candle, Timeframe, AssetSymbol, Position, InstitutionalSetup } from '../types/trading';
import { 
  calculateEMA, 
  calculateVWAP, 
  calculateRSI, 
  calculateCPR,
  detectFairValueGaps, 
  detectOrderBlocks, 
  detectLiquidityLevels 
} from '../services/technicalIndicators';
import { 
  Layers, 
  Maximize2, 
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
  Move,
  ChevronsRight,
  SlidersHorizontal
} from 'lucide-react';

interface InstitutionalChartProps {
  candles: Candle[];
  symbol: AssetSymbol;
  currentPrice: number;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  activePositions?: Position[];
  activeSetup: InstitutionalSetup | null;
  onApplySetup?: (setup: InstitutionalSetup) => void;
  onNavigateToSetups?: () => void;
}

const safeFixed = (val: number | undefined | null, digits: number = 1, fallback: string = '--'): string => {
  if (typeof val !== 'number' || isNaN(val)) return fallback;
  return val.toFixed(digits);
};

export const InstitutionalChart: React.FC<InstitutionalChartProps> = ({
  candles,
  symbol,
  currentPrice,
  timeframe,
  onTimeframeChange,
  activePositions = [],
  activeSetup,
  onApplySetup,
  onNavigateToSetups,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Indicators toggle state
  const [showCpr, setShowCpr] = useState(true);
  const [showVwap, setShowVwap] = useState(true);
  const [showEma, setShowEma] = useState(true);
  const [showFvg, setShowFvg] = useState(true);
  const [showOrderBlocks, setShowOrderBlocks] = useState(true);
  const [showLiquidity, setShowLiquidity] = useState(true);
  const [showRsi, setShowRsi] = useState(false);
  const [showHighLow, setShowHighLow] = useState(true);

  // Zoom & Pan continuous navigation state (TradingView-style direct viewport manipulation)
  const [candleSpacing, setCandleSpacing] = useState<number>(14);
  const [panX, setPanX] = useState<number>(0);
  const [isAutoPriceScale, setIsAutoPriceScale] = useState<boolean>(true);
  const [manualCenterPrice, setManualCenterPrice] = useState<number | null>(null);
  const [manualPriceSpan, setManualPriceSpan] = useState<number | null>(null);
  const [cursorStyle, setCursorStyle] = useState<'crosshair' | 'grabbing' | 'ns-resize' | 'ew-resize'>('crosshair');

  const lastPriceScaleRef = useRef<{ center: number; span: number; min: number; max: number }>({
    center: 24000,
    span: 200,
    min: 23900,
    max: 24100,
  });

  // Interactive drag state ref for active pointer tracking
  const dragRef = useRef<{
    isDragging: boolean;
    mode: 'pan' | 'priceScale' | 'timeScale';
    startX: number;
    startY: number;
    startPanX: number;
    startCenter: number;
    startSpan: number;
    startCandleSpacing: number;
    startIsAuto: boolean;
  }>({
    isDragging: false,
    mode: 'pan',
    startX: 0,
    startY: 0,
    startPanX: 0,
    startCenter: 24000,
    startSpan: 200,
    startCandleSpacing: 14,
    startIsAuto: true,
  });

  const adjustedRangeRef = useRef<number>(100);

  // Reset viewport when asset symbol changes
  useEffect(() => {
    setPanX(0);
    setIsAutoPriceScale(true);
    setManualCenterPrice(null);
    setManualPriceSpan(null);
    setCandleSpacing(14);
  }, [symbol]);

  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [dismissSetupBanner, setDismissSetupBanner] = useState<boolean>(false);

  // Hover crosshair state
  const [crosshair, setCrosshair] = useState<{
    x: number;
    y: number;
    candleIndex: number | null;
  } | null>(null);

  // Canvas dimensions
  const [dimensions, setDimensions] = useState({ width: 900, height: 500 });

  // Reset dismissed banner when activeSetup changes
  useEffect(() => {
    setDismissSetupBanner(false);
  }, [activeSetup?.setupName, activeSetup?.asset]);

  // Handle container resizing with ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setDimensions({
        width: Math.floor(rect.width),
        height: Math.floor(rect.height),
      });
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.floor(width),
            height: Math.floor(height),
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isMaximized]);

  // Zoom handlers
  const handleZoomIn = () => {
    setCandleSpacing((prev) => Math.min(45, Math.round(prev * 1.25)));
  };

  const handleZoomOut = () => {
    setCandleSpacing((prev) => Math.max(4, Math.round(prev * 0.8)));
  };

  const handleResetZoom = () => {
    setPanX(0);
    setCandleSpacing(14);
    setIsAutoPriceScale(true);
    setManualCenterPrice(null);
    setManualPriceSpan(null);
  };

  // Technical Calculations on full history
  const indicators = useMemo(() => {
    if (!candles || candles.length === 0) return null;
    const ema20 = calculateEMA(candles, 20);
    const ema50 = calculateEMA(candles, 50);
    const ema200 = calculateEMA(candles, Math.min(200, Math.max(20, Math.floor(candles.length * 0.7))));
    const vwapData = calculateVWAP(candles);
    const cpr = calculateCPR(candles);
    const rsi = calculateRSI(candles, 14);
    const fvgs = detectFairValueGaps(candles);
    const orderBlocks = detectOrderBlocks(candles);
    const liquidity = detectLiquidityLevels(candles);

    return {
      ema20,
      ema50,
      ema200,
      vwapData,
      cpr,
      rsi,
      fvgs,
      orderBlocks,
      liquidity,
    };
  }, [candles]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !candles || candles.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = dimensions.width;
    const height = dimensions.height;

    // Set high-DPI canvas buffer
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = '#080b11';
    ctx.fillRect(0, 0, width, height);

    // Layout metrics
    const rightAxisWidth = 85;
    const bottomAxisHeight = 26;
    const rsiHeight = showRsi ? 85 : 0;
    const chartWidth = width - rightAxisWidth;
    const chartHeight = height - bottomAxisHeight - rsiHeight;
    const volumeHeight = Math.min(65, chartHeight * 0.16);

    // TradingView Continuous Coordinate Calculations
    const totalCandles = candles.length;
    const defaultRightMarginBars = 5;
    const rightBaseX = chartWidth - defaultRightMarginBars * candleSpacing + panX;
    const getX = (i: number) => rightBaseX - (totalCandles - 1 - i) * candleSpacing;
    const candleWidth = Math.max(2, Math.min(32, candleSpacing * 0.72));

    // Determine range of candles currently visible within horizontal bounds
    const minVisibleI = Math.max(0, Math.floor((totalCandles - 1) - (rightBaseX + candleSpacing) / candleSpacing));
    const maxVisibleI = Math.min(totalCandles - 1, Math.ceil((totalCandles - 1) - (rightBaseX - chartWidth - candleSpacing) / candleSpacing));

    // 1. Calculate Min and Max Prices for scaling based on VISIBLE CANDLES
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;
    let highestIdx = Math.max(0, minVisibleI);
    let lowestIdx = Math.max(0, minVisibleI);

    for (let i = minVisibleI; i <= maxVisibleI; i++) {
      const c = candles[i];
      if (!c) continue;
      if (c.low < minPrice) {
        minPrice = c.low;
        lowestIdx = i;
      }
      if (c.high > maxPrice) {
        maxPrice = c.high;
        highestIdx = i;
      }
      if (c.volume > maxVolume) maxVolume = c.volume;
    }

    if (!isFinite(minPrice) || !isFinite(maxPrice) || minPrice >= maxPrice) {
      minPrice = currentPrice * 0.995;
      maxPrice = currentPrice * 1.005;
    }

    // Include active CPR levels in bounds if showCpr is on
    if (showCpr && indicators?.cpr) {
      if (indicators.cpr.tc > maxPrice && indicators.cpr.tc < maxPrice * 1.03) maxPrice = indicators.cpr.tc;
      if (indicators.cpr.bc < minPrice && indicators.cpr.bc > minPrice * 0.97) minPrice = indicators.cpr.bc;
    }

    // Add padding to price range
    const rawRange = maxPrice - minPrice;
    const padding = Math.max(rawRange * 0.12, currentPrice * 0.002);
    const autoMin = minPrice - padding;
    const autoMax = maxPrice + padding;
    const autoCenter = (autoMin + autoMax) / 2;
    const autoSpan = Math.max(0.01, autoMax - autoMin);

    const effectiveCenter = manualCenterPrice !== null ? manualCenterPrice : autoCenter;
    const effectiveSpan = manualPriceSpan !== null ? manualPriceSpan : autoSpan;

    const adjustedMin = effectiveCenter - effectiveSpan / 2;
    const adjustedMax = effectiveCenter + effectiveSpan / 2;
    const adjustedRange = Math.max(0.01, adjustedMax - adjustedMin);
    adjustedRangeRef.current = adjustedRange;

    lastPriceScaleRef.current = {
      center: effectiveCenter,
      span: effectiveSpan,
      min: adjustedMin,
      max: adjustedMax,
    };

    // Coordinate conversion functions
    const getY = (price: number) => {
      return chartHeight - ((price - adjustedMin) / adjustedRange) * chartHeight;
    };
    const getPriceFromY = (y: number) => {
      return adjustedMax - (y / chartHeight) * adjustedRange;
    };

    // Right axis background & divider
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(chartWidth, 0, rightAxisWidth, chartHeight);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(chartWidth, 0);
    ctx.lineTo(chartWidth, chartHeight);
    ctx.stroke();

    // Bottom time axis background & divider
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, chartHeight, width, bottomAxisHeight);
    ctx.strokeStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(0, chartHeight);
    ctx.lineTo(width, chartHeight);
    ctx.stroke();

    // Corner junction
    ctx.fillStyle = '#0d131f';
    ctx.fillRect(chartWidth, chartHeight, rightAxisWidth, bottomAxisHeight);

    // Draw Subtle Horizontal Price Grid Lines (6 steps)
    const priceSteps = 6;
    for (let i = 0; i <= priceSteps; i++) {
      const p = adjustedMin + (adjustedRange / priceSteps) * i;
      const y = getY(p);

      if (y >= 0 && y <= chartHeight) {
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(chartWidth, y);
        ctx.stroke();

        // Right axis price text (INR ₹)
        ctx.fillStyle = '#64748b';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`₹${p.toFixed(p > 1000 ? 1 : 2)}`, chartWidth + 6, y + 4);
      }
    }

    // Draw Time Grid Lines
    const labelStep = Math.max(1, Math.round(90 / Math.max(1, candleSpacing)));
    const firstI = Math.ceil(minVisibleI / labelStep) * labelStep;
    for (let i = firstI; i <= maxVisibleI; i += labelStep) {
      const c = candles[i];
      if (!c) continue;
      const x = getX(i);

      if (x >= 25 && x <= chartWidth - 25) {
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, chartHeight);
        ctx.stroke();

        const d = new Date(c.time);
        const timeStr = timeframe === '1D'
          ? `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`
          : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        ctx.fillStyle = '#64748b';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(timeStr, x, chartHeight + 17);
      }
    }

    // Draw Central Pivot Range (CPR) & Camarilla Pivots
    if (showCpr && indicators?.cpr) {
      const cpr = indicators.cpr;

      // CPR Shaded Band between TC and BC
      const yTC = getY(cpr.tc);
      const yBC = getY(cpr.bc);
      const yP = getY(cpr.pivot);

      if (yTC >= 0 && yBC >= 0 && yTC <= chartHeight && yBC <= chartHeight) {
        ctx.fillStyle = 'rgba(168, 85, 247, 0.08)';
        ctx.fillRect(0, Math.min(yTC, yBC), chartWidth, Math.abs(yTC - yBC));
      }

      // Top Central (TC)
      if (yTC >= 0 && yTC <= chartHeight) {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, yTC);
        ctx.lineTo(chartWidth, yTC);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`CPR TC: ₹${cpr.tc.toFixed(1)}`, 8, yTC - 3);
      }

      // Pivot
      if (yP >= 0 && yP <= chartHeight) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.4;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(0, yP);
        ctx.lineTo(chartWidth, yP);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#60a5fa';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`PIVOT: ₹${cpr.pivot.toFixed(1)} ${cpr.virginCpr ? '[VIRGIN CPR]' : ''}`, 8, yP - 3);
      }

      // Bottom Central (BC)
      if (yBC >= 0 && yBC <= chartHeight) {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(0, yBC);
        ctx.lineTo(chartWidth, yBC);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#c084fc';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`CPR BC: ₹${cpr.bc.toFixed(1)}`, 8, yBC - 3);
      }

      // Previous Day High (PDH) & Low (PDL)
      const yPDH = getY(cpr.pdh);
      if (yPDH >= 0 && yPDH <= chartHeight) {
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(0, yPDH);
        ctx.lineTo(chartWidth, yPDH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#34d399';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`PDH: ₹${cpr.pdh.toFixed(1)}`, chartWidth - 8, yPDH - 3);
      }

      const yPDL = getY(cpr.pdl);
      if (yPDL >= 0 && yPDL <= chartHeight) {
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(0, yPDL);
        ctx.lineTo(chartWidth, yPDL);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#fb7185';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.fillText(`PDL: ₹${cpr.pdl.toFixed(1)}`, chartWidth - 8, yPDL - 3);
      }
    }

    // Draw SMC Fair Value Gaps (FVG Zones)
    if (showFvg && indicators?.fvgs) {
      indicators.fvgs.forEach((fvg) => {
        const yTop = getY(fvg.top);
        const yBottom = getY(fvg.bottom);
        const startX = Math.max(0, getX(fvg.startIndex));
        const endX = chartWidth;

        if (startX < chartWidth) {
          ctx.fillStyle = fvg.type === 'bullish' 
            ? (fvg.mitigated ? 'rgba(16, 185, 129, 0.04)' : 'rgba(16, 185, 129, 0.14)')
            : (fvg.mitigated ? 'rgba(244, 63, 94, 0.04)' : 'rgba(244, 63, 94, 0.14)');
          
          ctx.fillRect(startX, yTop, endX - startX, yBottom - yTop);

          ctx.strokeStyle = fvg.type === 'bullish' ? 'rgba(16, 185, 129, 0.5)' : 'rgba(244, 63, 94, 0.5)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(startX, yTop, endX - startX, yBottom - yTop);
          ctx.setLineDash([]);

          ctx.fillStyle = fvg.type === 'bullish' ? '#10b981' : '#f43f5e';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`${fvg.type === 'bullish' ? 'BULL' : 'BEAR'} FVG`, startX + 4, yTop + 11);
        }
      });
    }

    // Draw SMC Order Blocks (OB)
    if (showOrderBlocks && indicators?.orderBlocks) {
      indicators.orderBlocks.forEach((ob) => {
        const yHigh = getY(ob.high);
        const yLow = getY(ob.low);
        const startX = Math.max(0, getX(ob.startIndex));
        const endX = chartWidth;

        if (startX < chartWidth) {
          ctx.fillStyle = ob.type === 'bullish' ? 'rgba(56, 189, 248, 0.10)' : 'rgba(251, 146, 60, 0.10)';
          ctx.fillRect(startX, yHigh, endX - startX, yLow - yHigh);

          ctx.strokeStyle = ob.type === 'bullish' ? 'rgba(56, 189, 248, 0.5)' : 'rgba(251, 146, 60, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(startX, yHigh, endX - startX, yLow - yHigh);

          ctx.fillStyle = ob.type === 'bullish' ? '#38bdf8' : '#fb923c';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`${ob.type === 'bullish' ? '+OB' : '-OB'} (${ob.status})`, startX + 4, yHigh + 11);
        }
      });
    }

    // Draw Liquidity Pools (BSL / SSL)
    if (showLiquidity && indicators?.liquidity) {
      indicators.liquidity.forEach((liq) => {
        const y = getY(liq.price);
        if (y >= 0 && y <= chartHeight) {
          ctx.strokeStyle = liq.type === 'BSL' ? 'rgba(226, 232, 240, 0.6)' : 'rgba(148, 163, 184, 0.6)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(chartWidth, y);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#cbd5e1';
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(`[${liq.type}] ${liq.label} - $${liq.price.toFixed(liq.price > 1000 ? 1 : 2)}`, 8, y - 4);
        }
      });
    }

    // Draw Volume Bars
    for (let i = minVisibleI; i <= maxVisibleI; i++) {
      const c = candles[i];
      if (!c) continue;
      const x = getX(i);
      const isUp = c.close >= c.open;
      const volRatio = c.volume / (maxVolume || 1);
      const vHeight = volRatio * volumeHeight;
      const y = chartHeight - vHeight;

      ctx.fillStyle = isUp ? 'rgba(16, 185, 129, 0.28)' : 'rgba(244, 63, 94, 0.28)';
      ctx.fillRect(x - candleWidth / 2, y, candleWidth, vHeight);
    }

    // Draw Candlesticks
    for (let i = minVisibleI; i <= maxVisibleI; i++) {
      const c = candles[i];
      if (!c) continue;
      const x = getX(i);
      const isUp = c.close >= c.open;
      const yOpen = getY(c.open);
      const yClose = getY(c.close);
      const yHigh = getY(c.high);
      const yLow = getY(c.low);

      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(2.5, Math.abs(yOpen - yClose));

      // Wick
      ctx.strokeStyle = isUp ? '#10b981' : '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body
      ctx.fillStyle = isUp ? '#10b981' : '#f43f5e';
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

      ctx.strokeStyle = isUp ? '#059669' : '#e11d48';
      ctx.lineWidth = 1;
      ctx.strokeRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

      // Pulse ring on current live candle
      if (i === totalCandles - 1) {
        ctx.strokeStyle = isUp ? 'rgba(16, 185, 129, 0.7)' : 'rgba(244, 63, 94, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(x - candleWidth / 2 - 2, bodyTop - 2, candleWidth + 4, bodyHeight + 4);
        ctx.setLineDash([]);
      }
    }

    // Session High & Low Markers
    if (showHighLow && candles[highestIdx] && candles[lowestIdx]) {
      const hX = getX(highestIdx);
      const hY = getY(candles[highestIdx].high);
      const lX = getX(lowestIdx);
      const lY = getY(candles[lowestIdx].low);

      // High Badge
      ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(hX - 35, hY - 22, 70, 16, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`▲ H $${candles[highestIdx].high.toFixed(candles[highestIdx].high > 1000 ? 1 : 2)}`, hX, hY - 10);

      // Low Badge
      ctx.fillStyle = 'rgba(244, 63, 94, 0.2)';
      ctx.strokeStyle = '#f43f5e';
      ctx.beginPath();
      ctx.roundRect(lX - 35, lY + 6, 70, 16, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fb7185';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`▼ L $${candles[lowestIdx].low.toFixed(candles[lowestIdx].low > 1000 ? 1 : 2)}`, lX, lY + 18);
    }

    // Draw VWAP and Bands
    if (showVwap && indicators?.vwapData) {
      // Main VWAP Line (Cyan)
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      let started = false;
      for (let i = minVisibleI; i <= maxVisibleI; i++) {
        const val = indicators.vwapData.vwap[i];
        if (val !== null && val !== undefined) {
          const x = getX(i);
          const y = getY(val);
          if (!started) {
            ctx.moveTo(x, y);
            started = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();

      // Upper +1.5 StdDev Band
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      let startedUpper = false;
      for (let i = minVisibleI; i <= maxVisibleI; i++) {
        const val = indicators.vwapData.upperBand1[i];
        if (val !== null && val !== undefined) {
          const x = getX(i);
          const y = getY(val);
          if (!startedUpper) {
            ctx.moveTo(x, y);
            startedUpper = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();

      // Lower -1.5 StdDev Band
      ctx.beginPath();
      let startedLower = false;
      for (let i = minVisibleI; i <= maxVisibleI; i++) {
        const val = indicators.vwapData.lowerBand1[i];
        if (val !== null && val !== undefined) {
          const x = getX(i);
          const y = getY(val);
          if (!startedLower) {
            ctx.moveTo(x, y);
            startedLower = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw EMA Lines (EMA 20 Amber, EMA 50 Indigo)
    if (showEma && indicators) {
      // EMA 20
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let started20 = false;
      for (let i = minVisibleI; i <= maxVisibleI; i++) {
        const val = indicators.ema20[i];
        if (val !== null && val !== undefined) {
          const x = getX(i);
          const y = getY(val);
          if (!started20) {
            ctx.moveTo(x, y);
            started20 = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();

      // EMA 50
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      let started50 = false;
      for (let i = minVisibleI; i <= maxVisibleI; i++) {
        const val = indicators.ema50[i];
        if (val !== null && val !== undefined) {
          const x = getX(i);
          const y = getY(val);
          if (!started50) {
            ctx.moveTo(x, y);
            started50 = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();
    }

    // Draw Active Positions Entry Lines
    (activePositions || []).filter((p) => p.symbol === symbol).forEach((pos) => {
      const y = getY(pos.entryPrice);
      ctx.strokeStyle = pos.side === 'BUY' ? '#10b981' : '#f43f5e';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(chartWidth, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = pos.side === 'BUY' ? '#10b981' : '#f43f5e';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`[${pos.product} ${pos.side}] $${pos.entryPrice.toFixed(pos.entryPrice > 1000 ? 1 : 2)} (${pos.lots ?? pos.size} ${pos.symbol === 'BTC/USD' ? 'BTC' : 'Lots'})`, 8, y - 5);
    });

    // Draw Active Setup Levels (SL, TP1, TP2)
    if (activeSetup && activeSetup.asset === symbol) {
      const ySl = getY(activeSetup.stopLoss);
      const yTp1 = getY(activeSetup.takeProfit1);
      const yTp2 = getY(activeSetup.takeProfit2);

      // SL Level (Red)
      if (ySl >= 0 && ySl <= chartHeight) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.3;
        ctx.setLineDash([5, 3]);
        ctx.beginPath();
        ctx.moveTo(0, ySl);
        ctx.lineTo(chartWidth, ySl);
        ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`[SL TRIGGER] $${activeSetup.stopLoss}`, 10, ySl - 4);
      }

      // TP1 Level (Emerald)
      if (yTp1 >= 0 && yTp1 <= chartHeight) {
        ctx.strokeStyle = '#10b981';
        ctx.setLineDash([4, 2]);
        ctx.beginPath();
        ctx.moveTo(0, yTp1);
        ctx.lineTo(chartWidth, yTp1);
        ctx.stroke();
        ctx.fillStyle = '#10b981';
        ctx.fillText(`[TP1 1:1.5] $${activeSetup.takeProfit1}`, 10, yTp1 - 4);
      }

      // TP2 Level (Bright Green)
      if (yTp2 >= 0 && yTp2 <= chartHeight) {
        ctx.strokeStyle = '#34d399';
        ctx.beginPath();
        ctx.moveTo(0, yTp2);
        ctx.lineTo(chartWidth, yTp2);
        ctx.stroke();
        ctx.fillStyle = '#34d399';
        ctx.fillText(`[TP2 TARGET] $${activeSetup.takeProfit2}`, 10, yTp2 - 4);
      }

      ctx.setLineDash([]);
    }

    // Draw Live Current Price Line with Right Axis Pill
    const yLive = getY(currentPrice);
    if (yLive >= 0 && yLive <= chartHeight) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(0, yLive);
      ctx.lineTo(chartWidth, yLive);
      ctx.stroke();
      ctx.setLineDash([]);

      // Live Price Pill on Right Axis
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.roundRect(chartWidth + 3, yLive - 10, rightAxisWidth - 6, 20, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`$${currentPrice.toFixed(currentPrice > 1000 ? 1 : 2)}`, chartWidth + rightAxisWidth / 2, yLive + 4);
    } else if (yLive < 0) {
      // Out of view above
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.roundRect(chartWidth + 3, 2, rightAxisWidth - 6, 18, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`▲ $${currentPrice.toFixed(currentPrice > 1000 ? 1 : 2)}`, chartWidth + rightAxisWidth / 2, 15);
    } else if (yLive > chartHeight) {
      // Out of view below
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.roundRect(chartWidth + 3, chartHeight - 20, rightAxisWidth - 6, 18, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`▼ $${currentPrice.toFixed(currentPrice > 1000 ? 1 : 2)}`, chartWidth + rightAxisWidth / 2, chartHeight - 7);
    }

    // Crosshair rendering
    if (crosshair) {
      const chY = crosshair.y;
      const chX = crosshair.x;
      const hasCandle = crosshair.candleIndex !== null && candles[crosshair.candleIndex];

      if (chY >= 0 && chY <= chartHeight && chX >= 0 && chX <= chartWidth) {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);

        // Horizontal crosshair line
        ctx.beginPath();
        ctx.moveTo(0, chY);
        ctx.lineTo(chartWidth, chY);
        ctx.stroke();

        // Vertical crosshair line
        const lineX = hasCandle ? getX(crosshair.candleIndex!) : chX;
        ctx.beginPath();
        ctx.moveTo(lineX, 0);
        ctx.lineTo(lineX, chartHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Crosshair Price Pill on Right Axis
        const chPrice = getPriceFromY(chY);
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(chartWidth + 3, chY - 9, rightAxisWidth - 6, 18, 3);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`$${chPrice.toFixed(chPrice > 1000 ? 1 : 2)}`, chartWidth + rightAxisWidth / 2, chY + 4);

        // Crosshair Time Pill on Bottom Axis
        if (hasCandle) {
          const chCandle = candles[crosshair.candleIndex!];
          const d = new Date(chCandle.time);
          const timeStr = timeframe === '1D'
            ? `${d.toLocaleDateString()}`
            : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
          ctx.fillStyle = '#1e293b';
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.roundRect(lineX - 35, chartHeight + 3, 70, 20, 3);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = '#f8fafc';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(timeStr, lineX, chartHeight + 16);
        }
      }
    }

    // Draw RSI Subpanel if enabled
    if (showRsi && indicators?.rsi) {
      const rsiYTop = chartHeight + bottomAxisHeight;

      ctx.strokeStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(0, rsiYTop);
      ctx.lineTo(width, rsiYTop);
      ctx.stroke();

      const getRsiY = (val: number) => rsiYTop + rsiHeight - (val / 100) * rsiHeight;
      ctx.fillStyle = 'rgba(168, 85, 247, 0.05)';
      ctx.fillRect(0, getRsiY(70), chartWidth, getRsiY(30) - getRsiY(70));

      ctx.strokeStyle = 'rgba(244, 63, 94, 0.3)';
      ctx.strokeRect(0, getRsiY(70), chartWidth, getRsiY(30) - getRsiY(70));

      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let startedRsi = false;
      for (let i = minVisibleI; i <= maxVisibleI; i++) {
        const r = indicators.rsi[i];
        if (r !== null && r !== undefined) {
          const x = getX(i);
          const y = getRsiY(r);
          if (!startedRsi) {
            ctx.moveTo(x, y);
            startedRsi = true;
          } else {
            ctx.lineTo(x, y);
          }
        }
      }
      ctx.stroke();

      ctx.fillStyle = '#a855f7';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      const lastRsi = indicators.rsi[candles.length - 1];
      ctx.fillText(`RSI(14): ${lastRsi ? lastRsi.toFixed(1) : '--'}`, 10, rsiYTop + 14);
    }
  }, [
    dimensions,
    candles,
    candleSpacing,
    panX,
    isAutoPriceScale,
    manualCenterPrice,
    manualPriceSpan,
    symbol,
    currentPrice,
    indicators,
    showCpr,
    showVwap,
    showEma,
    showFvg,
    showOrderBlocks,
    showLiquidity,
    showRsi,
    showHighLow,
    crosshair,
    activePositions,
    activeSetup,
  ]);

  // Dimensions & layout metrics
  const rightAxisWidth = 85;
  const bottomAxisHeight = 26;
  const rsiHeight = showRsi ? 85 : 0;
  const chartWidth = dimensions.width - rightAxisWidth;
  const chartHeight = dimensions.height - bottomAxisHeight - rsiHeight;

  // TradingView-style Wheel Zoom Listener (Centered around mouse position)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;

      if (mouseX >= chartWidth || e.ctrlKey || e.metaKey) {
        // Vertical price scale zoom (either hover over price axis or with Ctrl/Cmd)
        const factor = e.deltaY < 0 ? 0.92 : 1.08;
        const currentScale = lastPriceScaleRef.current;
        const baseSpan = manualPriceSpan !== null ? manualPriceSpan : currentScale.span;
        const baseCenter = manualCenterPrice !== null ? manualCenterPrice : currentScale.center;
        const newSpan = Math.max(1.0, baseSpan * factor);
        setManualPriceSpan(newSpan);
        setManualCenterPrice(baseCenter);
        setIsAutoPriceScale(false);
      } else if (e.shiftKey) {
        // Horizontal pan with Shift + scroll wheel
        setPanX((prev) => {
          const maxPanX = Math.max(0, (candles.length - 5) * candleSpacing);
          const minPanX = -chartWidth * 0.75;
          return Math.max(minPanX, Math.min(maxPanX, prev - e.deltaY * 1.5));
        });
      } else {
        // Horizontal time zoom centered around mouse cursor
        const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
        setCandleSpacing((prev) => {
          const next = Math.max(4, Math.min(45, prev * zoomFactor));
          // Keep the candle beneath the mouse stationary
          const totalCandles = candles.length;
          const defaultRightMarginBars = 5;
          const rightBaseXOld = chartWidth - defaultRightMarginBars * prev + panX;
          const candleIndexUnderMouse = (totalCandles - 1) - (rightBaseXOld - mouseX) / prev;

          const rightBaseXNewCandidate = chartWidth - defaultRightMarginBars * next + panX;
          const newCandleX = rightBaseXNewCandidate - (totalCandles - 1 - candleIndexUnderMouse) * next;
          const deltaAdjust = mouseX - newCandleX;

          setPanX((p) => {
            const maxPanX = Math.max(0, (totalCandles - 5) * next);
            const minPanX = -chartWidth * 0.75;
            return Math.max(minPanX, Math.min(maxPanX, p + deltaAdjust));
          });

          return next;
        });
      }
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [dimensions.width, chartWidth, candles.length, candleSpacing, panX]);

  // Handle pointer down (Direct 2D Inside Panning or Axis Scaling)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const localX = startX - rect.left;
    const localY = startY - rect.top;

    let mode: 'pan' | 'priceScale' | 'timeScale' = 'pan';
    if (localX >= chartWidth) {
      mode = 'priceScale';
      setCursorStyle('ns-resize');
    } else if (localY >= chartHeight && localY <= chartHeight + bottomAxisHeight) {
      mode = 'timeScale';
      setCursorStyle('ew-resize');
    } else {
      mode = 'pan';
      setCursorStyle('grabbing');
    }

    const currentScale = lastPriceScaleRef.current;
    const startState = {
      startX,
      startY,
      startPanX: panX,
      startCenter: manualCenterPrice !== null ? manualCenterPrice : currentScale.center,
      startSpan: manualPriceSpan !== null ? manualPriceSpan : currentScale.span,
      startCandleSpacing: candleSpacing,
      startIsAuto: isAutoPriceScale,
    };

    dragRef.current = {
      isDragging: true,
      mode,
      ...startState,
    };

    // Window level event listeners ensure smooth 60fps tracking without dropped drags
    const onWindowPointerMove = (moveEv: PointerEvent) => {
      const deltaX = moveEv.clientX - startState.startX;
      const deltaY = moveEv.clientY - startState.startY;

      if (mode === 'pan') {
        // Direct 2D movement inside: candles move freely left/right and up/down
        const maxPanX = Math.max(0, (candles.length - 5) * startState.startCandleSpacing);
        const minPanX = -chartWidth * 0.75;
        const newPanX = Math.max(minPanX, Math.min(maxPanX, startState.startPanX + deltaX));
        setPanX(newPanX);

        const pricePerPx = startState.startSpan / Math.max(1, chartHeight);
        const newCenter = startState.startCenter + deltaY * pricePerPx;
        setManualCenterPrice(newCenter);
        setManualPriceSpan(startState.startSpan);
        setIsAutoPriceScale(false);
      } else if (mode === 'priceScale') {
        const factor = Math.exp(deltaY * 0.005);
        const newSpan = Math.max(1.0, startState.startSpan * factor);
        setManualPriceSpan(newSpan);
        setManualCenterPrice(startState.startCenter);
        setIsAutoPriceScale(false);
      } else if (mode === 'timeScale') {
        const spacingDelta = deltaX * 0.08;
        setCandleSpacing(Math.max(4, Math.min(45, startState.startCandleSpacing + spacingDelta)));
      }
    };

    const onWindowPointerUp = () => {
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerup', onWindowPointerUp);
      window.removeEventListener('pointercancel', onWindowPointerUp);
      dragRef.current.isDragging = false;
      setCursorStyle('crosshair');
    };

    window.addEventListener('pointermove', onWindowPointerMove);
    window.addEventListener('pointerup', onWindowPointerUp);
    window.addEventListener('pointercancel', onWindowPointerUp);
  };

  // Handle pointer move (Crosshair tracking when not dragging)
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current.isDragging) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x >= chartWidth) {
      setCursorStyle('ns-resize');
      setCrosshair(null);
    } else if (y >= chartHeight && y <= chartHeight + bottomAxisHeight) {
      setCursorStyle('ew-resize');
      setCrosshair(null);
    } else {
      setCursorStyle('crosshair');
      const totalCandles = candles.length;
      const defaultRightMarginBars = 5;
      const rightBaseX = chartWidth - defaultRightMarginBars * candleSpacing + panX;
      const candleIdx = Math.round((totalCandles - 1) - (rightBaseX - x) / candleSpacing);

      if (candleIdx >= 0 && candleIdx < totalCandles) {
        setCrosshair({ x, y, candleIndex: candleIdx });
      } else {
        setCrosshair({ x, y, candleIndex: null });
      }
    }
  };

  // Handle pointer release
  const handlePointerUp = () => {
    dragRef.current.isDragging = false;
    setCursorStyle('crosshair');
  };

  // Handle double-click (TradingView reset behavior)
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (x >= chartWidth) {
      // Double clicking price scale resets vertical scale to auto
      setManualCenterPrice(null);
      setManualPriceSpan(null);
      setIsAutoPriceScale(true);
    } else {
      // Double clicking main chart resets both pan (X and Y) and scales to default
      setPanX(0);
      setManualCenterPrice(null);
      setManualPriceSpan(null);
      setCandleSpacing(14);
      setIsAutoPriceScale(true);
    }
  };

  const handleMouseLeave = () => {
    if (!dragRef.current.isDragging) {
      setCrosshair(null);
    }
  };

  const hoveredCandle = crosshair && crosshair.candleIndex !== null && candles[crosshair.candleIndex] 
    ? candles[crosshair.candleIndex] 
    : candles[candles.length - 1];

  const hasMatchingSetup = activeSetup && activeSetup.asset === symbol && !dismissSetupBanner;
  const barsBack = Math.max(0, Math.round(panX / Math.max(1, candleSpacing)));

  return (
    <div 
      className={`flex flex-col bg-[#0b0e14] border border-slate-800 rounded-lg overflow-hidden select-none transition-all ${
        isMaximized 
          ? 'fixed inset-2 z-50 shadow-2xl bg-[#080b11] border-cyan-500/40' 
          : 'min-h-[500px] h-[540px] xl:h-[590px] w-full'
      }`}
    >
      {/* Chart Top Control Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 px-3 py-2 bg-[#0d121c] text-xs gap-2">
        {/* Timeframe Selectors */}
        <div className="flex items-center gap-1">
          {(['1m', '3m', '5m', '15m', '1h', '1D'] as Timeframe[]).map((tf) => (
            <button
              key={tf}
              id={`tf-${tf}-btn`}
              onClick={() => onTimeframeChange(tf)}
              className={`px-2.5 py-1 rounded font-mono font-medium transition-all ${
                timeframe === tf
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tf}
            </button>
          ))}

          {/* Zoom & Viewport Controls */}
          <div className="flex items-center ml-2 border-l border-slate-800 pl-2 gap-1">
            <button
              onClick={handleZoomIn}
              title="Zoom In (Candles)"
              className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out (Candles)"
              className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setIsAutoPriceScale(true);
                setManualCenterPrice(null);
                setManualPriceSpan(null);
              }}
              title="Reset Price Scale to Auto"
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border transition-all ${
                !isAutoPriceScale || manualCenterPrice !== null || manualPriceSpan !== null
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              Auto
            </button>
            <button
              onClick={handleResetZoom}
              title="Reset View (Zoom, Pan & Scale)"
              className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors font-mono text-[10px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Indicator Filter Toggles & Maximize */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setShowCpr(!showCpr)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
              showCpr
                ? 'bg-purple-950/60 border-purple-500/40 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            CPR & PIVOTS
          </button>
          <button
            onClick={() => setShowVwap(!showVwap)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
              showVwap
                ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            VWAP
          </button>
          <button
            onClick={() => setShowEma(!showEma)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
              showEma
                ? 'bg-amber-950/60 border-amber-500/40 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            EMA 20/50
          </button>
          <button
            onClick={() => setShowFvg(!showFvg)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
              showFvg
                ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            SMC FVG
          </button>
          <button
            onClick={() => setShowOrderBlocks(!showOrderBlocks)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
              showOrderBlocks
                ? 'bg-sky-950/60 border-sky-500/40 text-sky-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            OB
          </button>
          <button
            onClick={() => setShowLiquidity(!showLiquidity)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
              showLiquidity
                ? 'bg-slate-800 border-slate-700 text-slate-200'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            BSL/SSL
          </button>
          <button
            onClick={() => setShowHighLow(!showHighLow)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
              showHighLow
                ? 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            H/L Tags
          </button>
          <button
            onClick={() => setShowRsi(!showRsi)}
            className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-all ${
              showRsi
                ? 'bg-purple-950/60 border-purple-500/40 text-purple-300'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}
          >
            RSI
          </button>

          {/* Maximize Toggle */}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? 'Restore View' : 'Maximize Chart'}
            className="p-1.5 ml-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition-colors border border-slate-800"
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Real-Time Candle Data HUD */}
      {hoveredCandle && (
        <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-[#090d14] border-b border-slate-900 text-[11px] font-mono text-slate-400">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div>
              <span className="text-slate-600">TIME:</span>{' '}
              <span className="text-slate-300">{new Date(hoveredCandle.time).toLocaleTimeString()}</span>
            </div>
            <div>
              <span className="text-slate-600">O:</span>{' '}
              <span className="text-slate-200">${hoveredCandle.open}</span>
            </div>
            <div>
              <span className="text-slate-600">H:</span>{' '}
              <span className="text-emerald-400">${hoveredCandle.high}</span>
            </div>
            <div>
              <span className="text-slate-600">L:</span>{' '}
              <span className="text-rose-400">${hoveredCandle.low}</span>
            </div>
            <div>
              <span className="text-slate-600">C:</span>{' '}
              <span className={hoveredCandle.close >= hoveredCandle.open ? 'text-emerald-400' : 'text-rose-400'}>
                ${hoveredCandle.close}
              </span>
            </div>
            <div>
              <span className="text-slate-600">VOL:</span>{' '}
              <span className="text-cyan-300">{hoveredCandle.volume}</span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-500">
            <span>Spacing: {candleSpacing}px</span>
            <span>•</span>
            <span>Total: {candles.length} candles</span>
            <span>•</span>
            <span className="text-cyan-400 font-semibold">{symbol}</span>
          </div>
        </div>
      )}

      {/* Main Interactive Canvas Area */}
      <div ref={containerRef} className="relative flex-1 min-h-[380px] w-full bg-[#080b11] overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={handleDoubleClick}
          onMouseLeave={handleMouseLeave}
          style={{ cursor: cursorStyle }}
          className="absolute inset-0 block touch-none"
        />

        {/* Floating Quick Hint Bar */}
        <div className="absolute bottom-8 left-3 pointer-events-none opacity-40 hover:opacity-100 transition-opacity bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800/60 text-[9px] font-mono text-slate-400 flex items-center gap-2">
          <span className="flex items-center gap-1 text-cyan-400"><Move className="w-2.5 h-2.5" /> Drag: 2D Pan (Free Move)</span>
          <span>•</span>
          <span>Wheel: Zoom At Cursor</span>
          <span>•</span>
          <span>Drag Right Axis: Price Scale</span>
          <span>•</span>
          <span>Double-Click: Reset View</span>
        </div>

        {/* Jump to Live Button if panned backward */}
        {panX > 25 && (
          <button
            onClick={() => setPanX(0)}
            className="absolute bottom-10 right-28 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold px-3 py-1 rounded-full shadow-xl text-[11px] font-mono flex items-center gap-1.5 transition-all active:scale-95 z-10"
            title="Jump to latest candle"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
            <span>Jump to Live ({barsBack} bars back)</span>
          </button>
        )}

        {/* Auto Price Scale Button if scaled or offset */}
        {(!isAutoPriceScale || manualCenterPrice !== null || manualPriceSpan !== null) && (
          <button
            onClick={() => {
              setIsAutoPriceScale(true);
              setManualCenterPrice(null);
              setManualPriceSpan(null);
            }}
            className="absolute bottom-9 right-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold px-2 py-0.5 rounded shadow z-10 transition-all"
            title="Reset price scale to auto"
          >
            AUTO
          </button>
        )}

        {/* Floating Active Setup Overlay on the Chart */}
        {hasMatchingSetup && activeSetup && (
          <div className="absolute top-2 left-3 bg-[#0d131f]/95 border border-cyan-500/40 backdrop-blur-md rounded-lg p-2.5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-3 text-xs max-w-xl animate-fadeIn z-10">
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 ${
                  activeSetup.signal.includes('BUY')
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {activeSetup.signal.includes('BUY') ? (
                  <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-rose-400" />
                )}
                {activeSetup.signal}
              </span>
              <span className="font-semibold text-slate-200 line-clamp-1">{activeSetup.setupName}</span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
              <span>Entry: <b className="text-slate-200">${activeSetup.entryPrice}</b></span>
              <span>SL: <b className="text-rose-400">${activeSetup.stopLoss}</b></span>
              <span>TP1: <b className="text-emerald-400">${activeSetup.takeProfit1}</b></span>
            </div>

            <div className="flex items-center gap-1.5 ml-auto">
              {onApplySetup && (
                <button
                  onClick={() => onApplySetup(activeSetup)}
                  className="px-2.5 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] rounded transition-all flex items-center gap-1 whitespace-nowrap shadow-sm"
                >
                  <Zap className="w-3 h-3" />
                  Load to Desk
                </button>
              )}
              {onNavigateToSetups && (
                <button
                  onClick={onNavigateToSetups}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] rounded transition-all whitespace-nowrap"
                >
                  Details
                </button>
              )}
              <button
                onClick={() => setDismissSetupBanner(true)}
                className="text-slate-500 hover:text-slate-300 text-xs px-1"
                title="Dismiss banner"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
