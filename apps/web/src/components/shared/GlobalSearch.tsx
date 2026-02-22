"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, Sparkles } from "lucide-react";
import type { AiAnswer, EntityCard } from "@knesset-vote/shared";

// ─── Search types ──────────────────────────────────────────────────────────

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
  mk: 'ח"כ',
  party: "סיעה",
  bill: "הצעת חוק",
};

const TYPE_COLORS: Record<string, string> = {
  mk: "bg-brand-100 text-brand-700",
  party: "bg-blue-100 text-blue-700",
  bill: "bg-green-100 text-green-700",
};

const ENTITY_CARD_COLORS: Record<string, string> = {
  mk: "bg-brand-50 border-brand-200 text-brand-800",
  party: "bg-blue-50 border-blue-200 text-blue-800",
  bill: "bg-green-50 border-green-200 text-green-800",
  minister: "bg-purple-50 border-purple-200 text-purple-800",
};

// ─── AI Answer Panel ───────────────────────────────────────────────────────

function AiAnswerPanel({ answer, onClose }: { answer: AiAnswer; onClose: () => void }) {
  return (
    <div
      className="border-brand-200 absolute left-0 right-0 top-full z-50 mt-1 max-h-[32rem] overflow-y-auto rounded-lg border bg-white shadow-xl"
      role="region"
      aria-label="תשובת AI"
    >
      {/* Header */}
      <div className="from-brand-50 flex items-center justify-between border-b border-neutral-100 bg-gradient-to-l to-white px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <Sparkles className="text-brand-600 h-3.5 w-3.5" aria-hidden="true" />
          <span className="text-brand-700 text-xs font-semibold">תשובת AI</span>
          <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
            {answer.model}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-600"
          aria-label="סגור תשובת AI"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Answer text */}
      <div className="px-4 py-3">
        <div
          className="prose prose-sm prose-neutral max-w-none text-sm leading-relaxed text-neutral-800"
          dir="rtl"
        >
          {answer.answer_md.split("\n").map((line, i) =>
            line.trim() ? (
              <p key={i} className="mb-1.5 last:mb-0">
                {line}
              </p>
            ) : null,
          )}
        </div>
      </div>

      {/* Entity cards */}
      {answer.entity_cards.length > 0 && (
        <div className="border-t border-neutral-100 px-4 py-2.5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            קישורים מהירים
          </p>
          <div className="flex flex-wrap gap-1.5">
            {answer.entity_cards.map((card: EntityCard) => (
              <Link
                key={card.url}
                href={card.url}
                onClick={onClose}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${ENTITY_CARD_COLORS[card.type] ?? "border-neutral-200 bg-neutral-50 text-neutral-700"}`}
              >
                {card.label}
                {card.meta && <span className="opacity-60">• {card.meta}</span>}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Citations */}
      {answer.citations.length > 0 && (
        <div className="border-t border-neutral-100 px-4 py-2.5">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            מקורות ({answer.citations.length})
          </p>
          <div className="space-y-0.5">
            {answer.citations.slice(0, 5).map((c, i) => (
              <a
                key={i}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-600 block truncate text-xs hover:underline"
              >
                [{i + 1}] {c.label}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Tool calls transparency */}
      {answer.tool_calls_made.length > 0 && (
        <div className="border-t border-neutral-100 px-4 py-2">
          <span className="text-[10px] text-neutral-400">
            נבדק באמצעות: <span className="font-mono">{answer.tool_calls_made.join(", ")}</span>
          </span>
        </div>
      )}

      {/* Disclaimer */}
      <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-2">
        <p className="text-[10px] leading-relaxed text-neutral-400" dir="rtl">
          {answer.disclaimer}
        </p>
      </div>
    </div>
  );
}

// ─── Main GlobalSearch component ───────────────────────────────────────────

export function GlobalSearch() {
  // Normal search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  // AI mode state
  const [aiMode, setAiMode] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<AiAnswer | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  // ── Normal search ──────────────────────────────────────────────────────

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const res = await fetch(`${apiBase}/api/search?q=${encodeURIComponent(q)}&type=all`, {
        headers: { "Content-Type": "application/json" },
      });
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

  // ── AI ask ────────────────────────────────────────────────────────────

  const askAI = useCallback(async (q: string) => {
    if (q.trim().length < 3) return;
    setAiLoading(true);
    setAiError(null);
    setAiAnswer(null);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const res = await fetch(`${apiBase}/api/ai/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q.trim() }),
      });
      if (res.status === 429) {
        setAiError("הגעת למגבלת השאלות (10 לדקה). נסה שוב עוד דקה.");
        return;
      }
      if (!res.ok) throw new Error(`${res.status}`);
      const data = (await res.json()) as { data: AiAnswer };
      setAiAnswer(data.data);
    } catch {
      setAiError("שגיאה בחיבור ל-AI. נסה שנית.");
    } finally {
      setAiLoading(false);
    }
  }, []);

  // ── Event handlers ────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    // Clear AI answer when query changes
    if (aiAnswer) setAiAnswer(null);
    if (aiError) setAiError(null);

    if (!aiMode) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(val), 250);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (aiMode) {
        setAiMode(false);
        setAiAnswer(null);
        setAiError(null);
      } else {
        closeSearch();
      }
      return;
    }

    if (aiMode) {
      if (e.key === "Enter" && query.trim().length >= 3) {
        e.preventDefault();
        void askAI(query);
      }
      return;
    }

    // Normal search keyboard nav
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
    setAiAnswer(null);
    setAiError(null);
    inputRef.current?.focus();
  };

  const toggleAiMode = () => {
    setAiMode((m) => !m);
    setAiAnswer(null);
    setAiError(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Close dropdown on outside click
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
    grouped[r.type]!.push(r);
  }

  // Flat list for keyboard nav
  const flat = results;

  return (
    <div className="relative" role="search">
      {/* Input row */}
      <div
        className={`flex items-center gap-2 rounded-lg border bg-neutral-50 px-3 py-1.5 transition-colors focus-within:bg-white ${
          aiMode
            ? "border-brand-400 focus-within:border-brand-500"
            : "focus-within:border-brand-500 border-neutral-300"
        }`}
      >
        {/* Icon: spinner or search/sparkles */}
        {loading || aiLoading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" aria-hidden="true" />
        ) : aiMode ? (
          <Sparkles className="text-brand-500 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <Search className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
        )}

        {/* Input */}
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!aiMode && results.length > 0) setOpen(true);
          }}
          placeholder={aiMode ? "שאל שאלה על הכנסת..." : 'חפש ח"כ, סיעה, הצעת חוק...'}
          className="w-full min-w-0 bg-transparent text-sm text-neutral-700 placeholder-neutral-400 focus:outline-none"
          aria-label={aiMode ? "שאלה לעוזר AI" : "חיפוש כללי"}
          aria-autocomplete={aiMode ? "none" : "list"}
          autoComplete="off"
        />

        {/* Clear button */}
        {query && (
          <button
            onClick={clearSearch}
            className="shrink-0 text-neutral-400 hover:text-neutral-600"
            aria-label="נקה"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}

        {/* AI mode toggle */}
        <button
          onClick={toggleAiMode}
          className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium transition-colors ${
            aiMode
              ? "bg-brand-100 text-brand-700 hover:bg-brand-200"
              : "hover:text-brand-600 text-neutral-400 hover:bg-neutral-100"
          }`}
          title={aiMode ? "חזור לחיפוש רגיל" : "שאל AI"}
          aria-pressed={aiMode}
        >
          ✨ AI
        </button>
      </div>

      {/* AI mode: loading */}
      {aiMode && aiLoading && (
        <div className="border-brand-200 absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-white p-4 shadow-lg">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <Loader2 className="text-brand-500 h-4 w-4 animate-spin" aria-hidden="true" />
            <span>מחפש ובודק נתונים...</span>
          </div>
        </div>
      )}

      {/* AI mode: error */}
      {aiMode && aiError && !aiLoading && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-red-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-red-600">{aiError}</p>
            <button
              onClick={() => void askAI(query)}
              className="shrink-0 rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
            >
              נסה שוב
            </button>
          </div>
        </div>
      )}

      {/* AI mode: answer panel */}
      {aiMode && aiAnswer && !aiLoading && (
        <AiAnswerPanel
          answer={aiAnswer}
          onClose={() => {
            setAiAnswer(null);
            setAiError(null);
          }}
        />
      )}

      {/* AI mode: hint (when mode active, query empty, no answer) */}
      {aiMode && !query && !aiAnswer && !aiLoading && !aiError && (
        <div className="border-brand-100 bg-brand-50 absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border px-4 py-3 shadow-sm">
          <p className="text-brand-700 text-xs" dir="rtl">
            <Sparkles className="mb-0.5 mr-1 inline h-3 w-3" aria-hidden="true" />
            הקלד שאלה ולחץ Enter. לדוגמה:
          </p>
          <ul className="text-brand-600 mt-1.5 space-y-0.5 text-xs" dir="rtl">
            {["מי שר המשפטים?", "כמה מנדטים יש לליכוד?", "מה הצעות החוק האחרונות בנושא חינוך?"].map(
              (example) => (
                <li
                  key={example}
                  className="cursor-pointer hover:underline"
                  onClick={() => {
                    setQuery(example);
                    inputRef.current?.focus();
                  }}
                >
                  • {example}
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      {/* Normal search: dropdown */}
      {!aiMode && open && (
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
                  className="text-brand-600 block border-t border-neutral-100 px-4 py-2.5 text-center text-sm hover:bg-neutral-50"
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
