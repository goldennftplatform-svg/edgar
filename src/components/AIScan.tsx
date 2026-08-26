"use client";

import { useEffect, useState, useCallback } from "react";
import { Brain, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface AIAnalysis {
  filingId: string;
  summary: string;
  marketImpact: string;
  sentiment: "bullish" | "bearish" | "neutral";
  confidence: number;
  suggestedMarkets: string[];
  riskFlags: string[];
  timestamp: number;
}

const SENTIMENT_ICON = {
  bullish: TrendingUp,
  bearish: TrendingDown,
  neutral: Minus,
};
const SENTIMENT_COLOR = {
  bullish: "text-emerald-400 bg-emerald-500/15",
  bearish: "text-red-400 bg-red-500/15",
  neutral: "text-zinc-400 bg-zinc-500/15",
};

export default function AIScan() {
  const [analyses, setAnalyses] = useState<AIAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-scan");
      const data = await res.json();
      setAnalyses(data);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 120000);
    return () => clearInterval(iv);
  }, [load]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold">AI Scan</h2>
          <span className="text-[10px] text-zinc-500 font-mono">Magma</span>
        </div>
        <button onClick={load} className="p-1 hover:bg-zinc-800 rounded">
          <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {analyses.map((a) => {
          const Icon = SENTIMENT_ICON[a.sentiment];
          return (
            <div key={a.filingId} className="px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
              <div className="flex items-center gap-2 mb-2">
                <span className={`flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold rounded ${SENTIMENT_COLOR[a.sentiment]}`}>
                  <Icon className="w-3 h-3" />
                  {a.sentiment.toUpperCase()}
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {(a.confidence * 100).toFixed(0)}% conf
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-relaxed mb-2">{a.summary}</p>
              <p className="text-[11px] text-zinc-400 leading-relaxed mb-2 italic">{a.marketImpact}</p>
              {a.riskFlags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {a.riskFlags.map((flag) => (
                    <span key={flag} className="flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono bg-red-500/10 text-red-400 rounded">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      {flag}
                    </span>
                  ))}
                </div>
              )}
              {a.suggestedMarkets.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {a.suggestedMarkets.map((m) => (
                    <span key={m} className="px-1.5 py-0.5 text-[9px] font-mono bg-violet-500/10 text-violet-400 rounded">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {analyses.length === 0 && !loading && (
          <div className="p-8 text-center text-zinc-500 text-sm">No analyses yet</div>
        )}
      </div>
    </div>
  );
}
