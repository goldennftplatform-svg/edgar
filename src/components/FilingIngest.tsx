"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  FileText, ArrowRight, ExternalLink,
  RefreshCw, Wifi, WifiOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface Filing {
  id: string;
  type: string;
  company: string;
  cik: string;
  date: string;
  description: string;
  url: string;
  impactScore: number;
  keywords: string[];
}

export default function FilingIngest() {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [source, setSource] = useState<"edgar" | "mock" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [selectedFiling, setSelectedFiling] = useState<Filing | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestSeqRef = useRef(0);

  const fetchFilings = useCallback(async () => {
    const requestSeq = ++requestSeqRef.current;
    try {
      const res = await fetch("/api/filing-pulse");
      const data = await res.json();
      if (requestSeq !== requestSeqRef.current) return;
      setFilings(data.filings || []);
      setSource(data.source);
      setError(data.error || null);
      setLastFetch(new Date().toLocaleTimeString());
    } catch (e) {
      if (requestSeq !== requestSeqRef.current) return;
      setSource(null);
      setError(String(e));
    } finally {
      if (requestSeq === requestSeqRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { fetchFilings(); }, 0);
    intervalRef.current = setInterval(fetchFilings, 30000);
    return () => { clearTimeout(t); if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchFilings]);

  const impactColor = (score: number) => {
    if (score >= 70) return "text-red-400 bg-red-500/20 border-red-500/30";
    if (score >= 50) return "text-amber-400 bg-amber-500/15 border-amber-500/25";
    if (score >= 30) return "text-yellow-400 bg-yellow-500/15 border-yellow-500/25";
    return "text-zinc-400 bg-zinc-500/15 border-zinc-500/25";
  };

  const typeColor = (type: string) => {
    if (type === "8-K") return "bg-purple-500/20 text-purple-300 border-purple-500/30";
    if (type === "10-K") return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    if (type === "10-Q") return "bg-cyan-500/20 text-cyan-300 border-cyan-500/30";
    if (type.includes("13D") || type.includes("13G")) return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    if (type === "S-1") return "bg-orange-500/20 text-orange-300 border-orange-500/30";
    return "bg-zinc-500/20 text-zinc-300 border-zinc-500/30";
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span className="text-sm font-semibold">EDGAR Feed</span>
          <span className="text-[10px] font-mono text-zinc-500">{filings.length} filings</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {source === "edgar" ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-amber-400" />
            )}
            <span className={`text-[9px] font-mono ${source === "edgar" ? "text-emerald-400" : "text-amber-400"}`}>
              {source === "edgar" ? "LIVE" : "FALLBACK"}
            </span>
          </div>
          {lastFetch && <span className="text-[9px] font-mono text-zinc-600">fetched {lastFetch}</span>}
          <button
            onClick={fetchFilings}
            disabled={loading}
            className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-mono bg-emerald-500/15 text-emerald-300 rounded border border-emerald-500/20 hover:bg-emerald-500/25 disabled:opacity-40 transition-colors"
          >
            {loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {loading ? "loading..." : "refresh"}
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-[10px] font-mono text-amber-400">⚠ {error}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && filings.length === 0 && (
          <div className="p-8 text-center text-zinc-500 text-sm">
            <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-zinc-600" />
            Connecting to EDGAR...
          </div>
        )}

        {filings.length > 0 && (
          <div className="divide-y divide-zinc-800/50">
            {filings.map((filing) => {
              const isSelected = selectedFiling?.id === filing.id;
              return (
                <div key={filing.id}>
                  <button
                    onClick={() => setSelectedFiling(isSelected ? null : filing)}
                    className={`w-full text-left px-4 py-3 transition-colors ${isSelected ? "bg-zinc-800/40" : "hover:bg-zinc-800/20"}`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${typeColor(filing.type)}`}>
                            {filing.type}
                          </span>
                          <span className={`px-1.5 py-0.5 text-[9px] font-mono rounded border ${impactColor(filing.impactScore)}`}>
                            impact {filing.impactScore}
                          </span>
                          {filing.impactScore >= 70 && (
                            <span className="px-1.5 py-0.5 text-[9px] font-mono bg-red-500/20 text-red-300 rounded border border-red-500/30">
                              high impact
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-zinc-200 truncate mb-0.5">
                          {filing.company.split("(")[0].trim()}
                        </p>
                        <p className="text-[10px] text-zinc-500 truncate">
                          {filing.description || "No description available"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] font-mono text-zinc-500 mb-0.5">
                          {formatDistanceToNow(new Date(filing.date), { addSuffix: true })}
                        </p>
                        {filing.url && filing.url !== "#" && (
                          <a
                            href={filing.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-[9px] font-mono text-zinc-600 hover:text-zinc-400"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            SEC
                          </a>
                        )}
                      </div>
                    </div>
                    
                    {filing.keywords.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {filing.keywords.slice(0, 4).map((kw, i) => (
                          <span key={i} className="px-1.5 py-0.5 text-[8px] font-mono bg-zinc-800 text-zinc-500 rounded">
                            {kw}
                          </span>
                        ))}
                        {filing.keywords.length > 4 && (
                          <span className="text-[8px] font-mono text-zinc-600">
                            +{filing.keywords.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                  
                  {isSelected && (
                    <div className="px-4 pb-3 ml-6">
                      <div className="mb-3">
                        <p className="text-[10px] font-mono text-zinc-500 mb-1 uppercase tracking-wider">Full Details</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-zinc-500">Company:</span>
                            <span className="text-[10px] text-zinc-300">{filing.company}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-zinc-500">CIK:</span>
                            <span className="text-[10px] text-zinc-300">{filing.cik}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-zinc-500">Filed:</span>
                            <span className="text-[10px] text-zinc-300">{filing.date}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-zinc-500">Impact:</span>
                            <span className="text-[10px] text-zinc-300">{filing.impactScore}/100</span>
                          </div>
                        </div>
                      </div>
                      
                      {filing.keywords.length > 0 && (
                        <div>
                          <p className="text-[10px] font-mono text-zinc-500 mb-1 uppercase tracking-wider">Keywords</p>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {filing.keywords.map((kw, i) => (
                              <span key={i} className="px-1.5 py-0.5 text-[9px] font-mono bg-zinc-800 text-zinc-400 rounded">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {filings.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <ArrowRight className="w-3 h-3 text-zinc-500" />
            <span className="text-[10px] font-mono text-zinc-500">
              Feed → Magma Analysis → Market Generation
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
