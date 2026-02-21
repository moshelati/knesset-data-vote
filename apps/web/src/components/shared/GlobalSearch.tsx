"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

interface SearchResult {
  type: "mk" | "party" | "bill";
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
}

interface SearchResponse {
  data: SearchResult[];
  query: string;
  total: number;
}

const TYPE_LABELS: Record<string, string> = {
  mk: "ח\"כ",
  party: "סיעה",
  bill: "הצעת חוק",
};

const TYPE_COLORS: Record<string, string> = {
  mk: "bg-brand-100 text-brand-700",
  party: "bg-blue-100 text-blue-700",
  bill: "bg-green-100 text-green-700",
};

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const res = await fetch(
        `${apiBase}/api/search?q=${encodeURIComponent(q)}&type=all`,
        { headers: { "Content-Type": "application/json" } },
      );
      if (!res.ok) throw new Error("search failed");
      const data: SearchResponse = await res.json();
      setResults(data.data.slice(0, 12));
      setOpen(true);
      setActiveIdx(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 250);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === "Enter" && query.trim()) {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        setOpen(false);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && results[activeIdx]) {
        router.push(results[activeIdx].url);
        closeSearch();
      } else {
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
        closeSearch();
      }
    } else if (e.key === "Escape") {
      closeSearch();
    }
  };

  const closeSearch = () => {
    setOpen(false);
    setActiveIdx(-1);
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        closeSearch();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  for (const r of results) {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  }

  // Flat list for keyboard nav
  const flat = results;

  return (
    <div className="relative" role="search">
      {/* Input */}
      <div className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 focus-within:border-brand-500 focus-within:bg-white transition-colors">
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" aria-hidden="true" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        )}
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          placeholder="חפש ח\"כ, סיעה, הצעת חוק..."
          className="w-full min-w-0 bg-transparent text-sm text-neutral-700 placeholder-neutral-400 focus:outline-none"
          aria-label="חיפוש כללי"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          autoComplete="off"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="shrink-0 text-neutral-400 hover:text-neutral-600"
            aria-label="נקה חיפוש"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg"
          role="listbox"
          aria-label="תוצאות חיפוש"
        >
          {results.length === 0 && !loading ? (
            <div className="p-4 text-center text-sm text-neutral-500">לא נמצאו תוצאות</div>
          ) : (
            <>
              {Object.entries(grouped).map(([type, items]) => (
                <div key={type}>
                  <div className="sticky top-0 bg-neutral-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    {TYPE_LABELS[type] ?? type}
                  </div>
                  {items.map((result) => {
                    const flatIdx = flat.indexOf(result);
                    const isActive = flatIdx === activeIdx;
                    return (
                      <Link
                        key={`${result.type}-${result.id}`}
                        href={result.url}
                        role="option"
                        aria-selected={isActive}
                        onClick={closeSearch}
                        onMouseEnter={() => setActiveIdx(flatIdx)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          isActive ? "bg-brand-50" : "hover:bg-neutral-50"
                        }`}
                      >
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[result.type] ?? "bg-neutral-100 text-neutral-600"}`}
                        >
                          {TYPE_LABELS[result.type] ?? result.type}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-neutral-900">{result.title}</p>
                          {result.subtitle && (
                            <p className="truncate text-xs text-neutral-500">{result.subtitle}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}

              {/* Full results link */}
              {query.trim().length >= 2 && (
                <Link
                  href={`/search?q=${encodeURIComponent(query.trim())}`}
                  onClick={closeSearch}
                  className="block border-t border-neutral-100 px-4 py-2.5 text-center text-sm text-brand-600 hover:bg-neutral-50"
                >
                  כל התוצאות עבור &ldquo;{query}&rdquo; →
                </Link>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
