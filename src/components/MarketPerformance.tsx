"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Clock, TrendingUp, TrendingDown, BarChart3, Zap, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Market {
  id: string;
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  category: string;
  timeHorizon: string;
  resolutionSource: string;
  generatedFrom: string;
  sentiment: number;
  createdAt: string;
  lastUpdated: string;
}

export default function MarketPerformance() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch("/api/market-pulse");
      const data = await res.json();
      if (data.markets) {
        setMarkets(data.markets);
      }
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMarkets();
    intervalRef.current = setInterval(fetchMarkets, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchMarkets]);

  const filteredMarkets = selectedCategory === "all" 
    ? markets 
    : markets.filter(m => m.category === selectedCategory);

  const categories = ["all", ...new Set(markets.map(m => m.category))];

  const avgSentiment = markets.length > 0 
    ? markets.reduce((sum, m) => sum + m.sentiment, 0) / markets.length 
    : 0;

  const totalVolume = markets.reduce((sum, m) => sum + m.volume, 0);

  const highConfidenceMarkets = markets.filter(m => m.yesPrice > 0.7 || m.yesPrice < 0.3);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold">Market Performance</span>
          <span className="text-[10px] font-mono text-zinc-500">{markets.length} markets</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500">
            <span>avg sentiment {(avgSentiment * 100).toFixed(1)}%</span>
            <span>·</span>
            <span>total volume ${totalVolume.toLocaleString()}</span>
          </div>
          <button
            onClick={fetchMarkets}
            className="p-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>
      </div>

      <div className="px-4 py-2 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-1 text-[10px] font-mono rounded transition-colors ${
                selectedCategory === cat
                  ? "bg-zinc-700 text-zinc-200"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-zinc-600" />
            Loading markets...
          </div>
        ) : filteredMarkets.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-sm">
            <BarChart3 className="w-8 h-8 mx-auto mb-3 text-zinc-600" />
            <p className="font-medium mb-1">No markets found</p>
            <p className="text-xs text-zinc-600">Markets will appear as filings are analyzed</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {filteredMarkets.map((market) => {
              const yesPct = Math.round(market.yesPrice * 100);
              const noPct = Math.round(market.noPrice * 100);
              const sentimentColor = market.sentiment >= 0.6 ? "text-emerald-400" : 
                                   market.sentiment <= 0.4 ? "text-red-400" : "text-zinc-400";
              const isHighConfidence = market.yesPrice > 0.7 || market.yesPrice < 0.3;
              
              return (
                <div key={market.id} className={`px-4 py-3 hover:bg-zinc-800/30 transition-colors ${isHighConfidence ? "bg-zinc-800/20" : ""}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-zinc-200 leading-snug mb-1">
                        {market.question}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 text-[9px] font-mono bg-zinc-800 text-zinc-400 rounded">
                          {market.category}
                        </span>
                        <span className="text-[9px] font-mono text-zinc-500">
                          {market.timeHorizon} horizon
                        </span>
                        {isHighConfidence && (
                          <span className="px-1.5 py-0.5 text-[9px] font-mono bg-amber-500/20 text-amber-300 rounded">
                            high confidence
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] font-mono text-zinc-500 mb-0.5">
                        vol ${market.volume.toLocaleString()}
                      </p>
                      <p className="text-[9px] font-mono text-zinc-600">
                        {formatDistanceToNow(new Date(market.lastUpdated), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono text-emerald-400">YES {yesPct}%</span>
                        <span className="text-[9px] font-mono text-red-400">NO {noPct}%</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: `${yesPct}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {market.sentiment >= 0.6 ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : market.sentiment <= 0.4 ? (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      ) : (
                        <Clock className="w-3 h-3 text-zinc-500" />
                      )}
                      <span className={`text-[9px] font-mono ${sentimentColor}`}>
                        {(market.sentiment * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-2 flex items-center gap-2 text-[9px] font-mono text-zinc-600">
                    <span>from: {market.generatedFrom.split("(")[0].trim()}</span>
                    <span>·</span>
                    <span>resolution: {market.resolutionSource}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {highConfidenceMarkets.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Zap className="w-3 h-3 text-amber-400" />
            <span className="text-[10px] font-mono text-zinc-400">
              {highConfidenceMarkets.length} high-confidence market{highConfidenceMarkets.length !== 1 ? "s" : ""} detected
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
