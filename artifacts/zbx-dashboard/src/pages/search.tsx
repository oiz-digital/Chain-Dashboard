import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  Search, Box, ArrowRightLeft, Wallet, Users, Vote, Droplets,
  Loader2, AlertCircle, Hash, ChevronRight, Clock, Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

type ResultType = "block" | "transaction" | "address" | "validator" | "proposal" | "pool";

interface SearchResult {
  type:    ResultType;
  id:      string;
  title:   string;
  subtitle:string;
  data:    Record<string, unknown>;
}

interface SearchResponse {
  query:   string;
  total:   number;
  results: SearchResult[];
}

const TYPE_META: Record<ResultType, { label: string; icon: React.ElementType; color: string; href: (id: string) => string }> = {
  block:       { label: "Block",       icon: Box,            color: "text-blue-400 bg-blue-500/10 border-blue-500/20",       href: (id) => `/blocks/${id}` },
  transaction: { label: "Transaction", icon: ArrowRightLeft, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", href: (id) => `/transactions/${id}` },
  address:     { label: "Address",     icon: Wallet,         color: "text-amber-400 bg-amber-500/10 border-amber-500/20",     href: (id) => `/wallet?address=${id}` },
  validator:   { label: "Validator",   icon: Users,          color: "text-violet-400 bg-violet-500/10 border-violet-500/20",  href: (id) => `/validators/${id}` },
  proposal:    { label: "Proposal",    icon: Vote,           color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",        href: (id) => `/governance` },
  pool:        { label: "Pool",        icon: Droplets,       color: "text-teal-400 bg-teal-500/10 border-teal-500/20",        href: (id) => `/pools` },
};

const EXAMPLE_QUERIES = [
  { label: "Block by height", q: "2847312" },
  { label: "Search validator", q: "ZebvixNode" },
  { label: "Search proposal", q: "ZEP" },
  { label: "Search pool", q: "ZBX" },
];

export default function SearchPage() {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<SearchResponse | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [, navigate]            = useLocation();
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults(null); setError(null); return; }
    setLoading(true); setError(null);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const resp = await fetch(`${base}/api/search?q=${encodeURIComponent(q.trim())}`);
      if (!resp.ok) throw new Error(await resp.text());
      const data: SearchResponse = await resp.json();
      setResults(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 350);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      doSearch(query);
    }
  };

  const handleResultClick = (r: SearchResult) => {
    const meta = TYPE_META[r.type];
    navigate(meta.href(r.id));
  };

  const grouped = results
    ? (Object.keys(TYPE_META) as ResultType[]).reduce<Record<ResultType, SearchResult[]>>((acc, t) => {
        acc[t] = results.results.filter(r => r.type === t);
        return acc;
      }, {} as Record<ResultType, SearchResult[]>)
    : null;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Search className="h-6 w-6 text-primary" />
          Global Search
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search by block height, tx hash, address, validator name, or proposal keyword
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        {loading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />}
        <input
          autoFocus
          value={query}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search blocks, transactions, addresses, validators, proposals..."
          className="w-full pl-12 pr-12 py-4 rounded-xl bg-card border border-border text-base placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all"
        />
      </div>

      {/* Example queries */}
      {!query && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-3">Try searching for</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map(ex => (
              <button
                key={ex.q}
                onClick={() => { setQuery(ex.q); doSearch(ex.q); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/40 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Clock className="h-3 w-3" />
                <span className="font-mono text-xs">{ex.q}</span>
                <span className="text-xs text-muted-foreground/50">— {ex.label}</span>
              </button>
            ))}
          </div>

          {/* Search tips */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.entries(TYPE_META) as [ResultType, typeof TYPE_META[ResultType]][]).map(([type, meta]) => {
              const Icon = meta.icon;
              return (
                <div key={type} className={cn("flex items-center gap-3 p-3 rounded-lg border", meta.color.split(" ").slice(1).join(" "))}>
                  <Icon className={cn("h-4 w-4 flex-shrink-0", meta.color.split(" ")[0])} />
                  <div>
                    <p className="text-xs font-semibold">{meta.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {type === "block"       && "Enter a block number"}
                      {type === "transaction" && "Paste a 0x... hash (66 chars)"}
                      {type === "address"     && "Paste a 0x... or zbx1... address"}
                      {type === "validator"   && "Enter validator moniker or address"}
                      {type === "proposal"    && "Search by title or description keyword"}
                      {type === "pool"        && "Search by token symbol"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              {results.total === 0
                ? `No results for "${results.query}"`
                : `${results.total} result${results.total !== 1 ? "s" : ""} for "${results.query}"`}
            </p>
            {results.total > 0 && (
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-green-400" />
                <span className="text-xs text-green-400 font-mono">Live</span>
              </div>
            )}
          </div>

          {results.total === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-base font-medium">Nothing found</p>
              <p className="text-sm mt-1">Try a different query — block number, hash, moniker, or keyword</p>
            </div>
          )}

          {grouped && (Object.entries(grouped) as [ResultType, SearchResult[]][]).map(([type, items]) => {
            if (items.length === 0) return null;
            const meta = TYPE_META[type];
            const Icon = meta.icon;
            return (
              <div key={type} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn("h-4 w-4", meta.color.split(" ")[0])} />
                  <span className={cn("text-xs font-semibold uppercase tracking-wider", meta.color.split(" ")[0])}>
                    {meta.label}s
                  </span>
                  <span className="text-xs text-muted-foreground/50">({items.length})</span>
                </div>
                <div className="space-y-1.5">
                  {items.map((r, i) => (
                    <button
                      key={i}
                      onClick={() => handleResultClick(r)}
                      className="w-full flex items-center gap-4 p-3.5 rounded-lg bg-card border border-border/60 hover:border-border hover:bg-card/80 transition-all text-left group"
                    >
                      <div className={cn("h-8 w-8 rounded-lg border flex items-center justify-center flex-shrink-0", meta.color.split(" ").slice(1).join(" "))}>
                        <Icon className={cn("h-4 w-4", meta.color.split(" ")[0])} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                          {r.title}
                        </p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{r.subtitle}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary/60 flex-shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
