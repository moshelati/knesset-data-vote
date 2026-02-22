"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Search, X, Loader2, Sparkles, Clock, ThumbsUp, ThumbsDown } from "lucide-react";
import type { AiAnswer, EntityCard } from "@knesset-vote/shared";

// ─── Types ──────────────────────────────────────────────────────────────────

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

interface HistoryItem {
  question: string;
  ts: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

const HISTORY_KEY = "kv_ai_history";
const HISTORY_MAX = 8;

/** Context-aware suggested questions keyed by pathname prefix */
const SUGGESTED_BY_PATH: Array<{ match: RegExp; questions: string[] }> = [
  {
    match: /^\/mks\/[^/]+$/,
    questions: [
      'כמה הצעות חוק הגיש חה"כ הזה?',
      "באיזה ועדות הוא חבר?",
      "כיצד הצביע בנושאי ביטחון?",
    ],
  },
  {
    match: /^\/parties\/[^/]+$/,
    questions: ["כמה מנדטים יש לסיעה?", 'מי הח"כים בסיעה?', "האם הסיעה בקואליציה?"],
  },
  {
    match: /^\/bills\/[^/]+$/,
    questions: ["מה המצב העדכני של הצעת החוק?", "מי הגיש את הצעת החוק?", "מה התוכן של הצעת החוק?"],
  },
  {
    match: /^\/government/,
    questions: ["מי שר האוצר?", "מי שר המשפטים?", "כמה שרים יש בממשלה?"],
  },
  {
    match: /./,
    questions: ["מי שר המשפטים?", "כמה מנדטים יש לליכוד?", "מה הצעות החוק האחרונות בנושא חינוך?"],
  },
];

function getSuggestedQuestions(pathname: string): string[] {
  const entry = SUGGESTED_BY_PATH.find(({ match }) => match.test(pathname));
  return entry?.questions ?? SUGGESTED_BY_PATH[SUGGESTED_BY_PATH.length - 1]!.questions;
}

// ─── localStorage helpers ────────────────────────────────────────────────────

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryItem[];
  } catch {
    return [];
  }
}

function saveToHistory(question: string) {
  const prev = loadHistory().filter((h) => h.question !== question);
  const next: HistoryItem[] = [{ question, ts: Date.now() }, ...prev].slice(0, HISTORY_MAX);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* quota exceeded — ignore */
  }
}

function removeFromHistory(question: string) {
  const next = loadHistory().filter((h) => h.question !== question);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

// ─── AI Answer Panel ─────────────────────────────────────────────────────────

function AiAnswerPanel({
  answer,
  onClose,
  onFeedback,
}: {
  answer: AiAnswer;
  onClose: () => void;
  onFeedback: (positive: boolean) => void;
}) {
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);

  const handleFeedback = (positive: boolean) => {
    if (feedbackGiven) return;
    setFeedbackGiven(positive ? "up" : "down");
    onFeedback(positive);
  };

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
        <div className="flex items-center gap-2">
          {/* Feedback buttons */}
          <div className="flex items-center gap-1" aria-label="דרג תשובה">
            <button
              onClick={() => handleFeedback(true)}
              aria-label="תשובה טובה"
              className={`rounded p-1 transition-colors ${
                feedbackGiven === "up"
                  ? "bg-green-100 text-green-600"
                  : "text-neutral-400 hover:bg-green-50 hover:text-green-500"
              }`}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => handleFeedback(false)}
              aria-label="תשובה לא טובה"
              className={`rounded p-1 transition-colors ${
                feedbackGiven === "down"
                  ? "bg-red-100 text-red-600"
                  : "text-neutral-400 hover:bg-red-50 hover:text-red-500"
              }`}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-600"
            aria-label="סגור תשובת AI"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
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

// ─── Main GlobalSearch component ─────────────────────────────────────────────

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

  // History state (loaded lazily to avoid SSR mismatch)
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const suggestedQuestions = getSuggestedQuestions(pathname ?? "/");

  // Load history on mount (client-only)
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  // ── Normal search ───────────────────────────────────────────────────────

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

  // ── AI ask ─────────────────────────────────────────────────────────────

  const askAI = useCallback(async (q: string) => {
    if (q.trim().length < 3) return;
    setAiLoading(true);
    setAiError(null);
    setAiAnswer(null);
    setShowHistory(false);
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
      // Save to history
      saveToHistory(q.trim());
      setHistory(loadHistory());
    } catch {
      setAiError("שגיאה בחיבור ל-AI. נסה שנית.");
    } finally {
      setAiLoading(false);
    }
  }, []);

  // ── Feedback ───────────────────────────────────────────────────────────

  const handleFeedback = useCallback(
    async (positive: boolean) => {
      if (!aiAnswer) return;
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
        // Best-effort: fire and forget
        void fetch(`${apiBase}/api/ai/feedback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: aiAnswer.question,
            positive,
            model: aiAnswer.model,
          }),
        });
      } catch {
        /* ignore */
      }
    },
    [aiAnswer],
  );

  // ── Event handlers ─────────────────────────────────────────────────────

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (aiAnswer) setAiAnswer(null);
    if (aiError) setAiError(null);

    if (aiMode) {
      // Show history dropdown when user starts typing in AI mode
      setShowHistory(val.length === 0 && history.length > 0);
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(val), 250);
    }
  };

  const handleFocus = () => {
    if (aiMode && !query && history.length > 0) {
      setShowHistory(true);
    } else if (!aiMode && results.length > 0) {
      setOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (showHistory) {
        setShowHistory(false);
      } else if (aiMode) {
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
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const toggleAiMode = () => {
    setAiMode((m) => {
      const next = !m;
      if (next && !query && history.length > 0) {
        setShowHistory(true);
      }
      return next;
    });
    setAiAnswer(null);
    setAiError(null);
    setOpen(false);
    inputRef.current?.focus();
  };

  const pickQuestion = (q: string) => {
    setQuery(q);
    setShowHistory(false);
    inputRef.current?.focus();
    void askAI(q);
  };

  const deleteHistoryItem = (e: React.MouseEvent, q: string) => {
    e.stopPropagation();
    removeFromHistory(q);
    setHistory(loadHistory());
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
        setShowHistory(false);
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
        {/* Icon */}
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
          onFocus={handleFocus}
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
          onFeedback={handleFeedback}
        />
      )}

      {/* AI mode: history + suggested questions (when mode active, query empty, no answer) */}
      {aiMode && !query && !aiAnswer && !aiLoading && !aiError && showHistory && (
        <div
          ref={dropdownRef}
          className="border-brand-100 absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border bg-white shadow-lg"
          dir="rtl"
        >
          {/* History section */}
          {history.length > 0 && (
            <div>
              <p className="border-b border-neutral-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                שאלות אחרונות
              </p>
              {history.map((item) => (
                <div
                  key={item.ts}
                  onClick={() => pickQuestion(item.question)}
                  className="group flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-neutral-50"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-neutral-300" aria-hidden="true" />
                  <span className="flex-1 truncate text-neutral-700">{item.question}</span>
                  <button
                    onClick={(e) => deleteHistoryItem(e, item.question)}
                    aria-label="הסר מהיסטוריה"
                    className="hidden shrink-0 text-neutral-300 hover:text-red-400 group-hover:block"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Suggested questions for current page */}
          <div className={history.length > 0 ? "border-t border-neutral-100" : ""}>
            <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
              שאלות מוצעות
            </p>
            {suggestedQuestions.map((q) => (
              <div
                key={q}
                onClick={() => pickQuestion(q)}
                className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm hover:bg-neutral-50"
              >
                <Sparkles className="text-brand-300 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="text-neutral-600">{q}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI mode: static hint (focus not triggered yet) */}
      {aiMode && !query && !aiAnswer && !aiLoading && !aiError && !showHistory && (
        <div className="border-brand-100 bg-brand-50 absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border px-4 py-3 shadow-sm">
          <p className="text-brand-700 text-xs" dir="rtl">
            <Sparkles className="mb-0.5 mr-1 inline h-3 w-3" aria-hidden="true" />
            הקלד שאלה ולחץ Enter, או לחץ על שדה החיפוש לראות הצעות.
          </p>
          <ul className="text-brand-600 mt-1.5 space-y-0.5 text-xs" dir="rtl">
            {suggestedQuestions.map((example) => (
              <li
                key={example}
                className="cursor-pointer hover:underline"
                onClick={() => pickQuestion(example)}
              >
                • {example}
              </li>
            ))}
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
