"use client";

import { useEffect, useState, useCallback } from "react";
import { FileText, RefreshCw, ExternalLink, Zap } from "lucide-react";

interface Filing {
  id: string;
  type: string;
  company: string;
  date: string;
  description: string;
  url: string;
  impactScore: number;
  keywords: string[];
}

const IMPACT_COLORS: Record<string, string> = {
  high: "text-red-400 bg-red-500/15",
  medium: "text-amber-400 bg-amber-500/15",
  low: "text-zinc-400 bg-zinc-500/15",
};

const TYPE_COLORS: Record<string, string> = {
  "8-K": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "10-K": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "10-Q": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "4": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "SC 13D": "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "SC 13G": "bg-rose-500/20 text-rose-400 border-rose-500/30",
  "S-1": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "FORM D": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
};

export default function FilingStream({ onSelect }: { onSelect?: (filing: Filing) => void }) {
  const [filings, setFilings] = useState<Filing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/filing-pulse");
      const data = await res.json();
      setFilings(data);
    } catch { /* */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 45000);
    return () => clearInterval(iv);
  }, [load]);

  function getImpact(score: number): "high" | "medium" | "low" {
    if (score >= 70) return "high";
    if (score >= 40) return "medium";
    return "low";
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <h2 className="text-sm font-semibold">Filing Pulse</h2>
          <span className="px-1.5 py-0.5 text-[10px] font-mono bg-emerald-500/20 text-emerald-400 rounded animate-pulse">LIVE</span>
        </div>
        <button onClick={load} className="p-1 hover:bg-zinc-800 rounded">
          <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filings.map((f) => {
          const impact = getImpact(f.impactScore);
          const selected = selectedId === f.id;
          return (
            <div
              key={f.id}
              onClick={() => { setSelectedId(selected ? null : f.id); onSelect?.(f); }}
              className={`px-4 py-3 border-b border-zinc-800/50 cursor-pointer transition-colors ${
                selected ? "bg-indigo-500/10 border-l-2 border-l-indigo-500" : "hover:bg-zinc-800/30"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded border ${TYPE_COLORS[f.type] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30"}`}>
                      {f.type}
                    </span>
                    <span className={`flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono font-bold rounded ${IMPACT_COLORS[impact]}`}>
                      <Zap className="w-2.5 h-2.5" />
                      {f.impactScore}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">{f.date}</span>
                  </div>
                  <p className="text-xs font-medium text-zinc-200 truncate">{f.company}</p>
                  {f.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {f.keywords.slice(0, 4).map((kw) => (
                        <span key={kw} className="px-1.5 py-0.5 text-[9px] font-mono bg-zinc-800 text-zinc-400 rounded">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {f.url !== "#" && (
                  <a href={f.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="p-1 hover:bg-zinc-700 rounded shrink-0">
                    <ExternalLink className="w-3 h-3 text-zinc-500" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
        {filings.length === 0 && !loading && (
          <div className="p-8 text-center text-zinc-500 text-sm">No filings found</div>
        )}
      </div>
    </div>
  );
}
