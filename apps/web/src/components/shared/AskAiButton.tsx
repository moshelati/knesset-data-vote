"use client";

/**
 * AskAiButton — inline AI ask widget for entity pages (MK / party / bill).
 *
 * Renders a small "שאל AI" button. On click, opens an inline panel with
 * a pre-filled question based on the entity context. The user can edit the
 * question before submitting.
 *
 * Uses GET /api/ai/stream (SSE) for streaming responses.
 */

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Sparkles, ChevronDown, ChevronUp, Loader2, X, ThumbsUp, ThumbsDown } from "lucide-react";
import type { AiAnswer, EntityCard } from "@knesset-vote/shared";

interface AskAiButtonProps {
  /** Pre-filled question to start with */
  defaultQuestion: string;
  /** Optional extra suggested questions */
  suggestions?: string[];
}

const ENTITY_CARD_COLORS: Record<string, string> = {
  mk: "bg-brand-50 border-brand-200 text-brand-800",
  party: "bg-blue-50 border-blue-200 text-blue-800",
  bill: "bg-green-50 border-green-200 text-green-800",
  minister: "bg-purple-50 border-purple-200 text-purple-800",
};

export function AskAiButton({ defaultQuestion, suggestions = [] }: AskAiButtonProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(defaultQuestion);
  const [answer, setAnswer] = useState<AiAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);
  // Streaming state
  const [streamText, setStreamText] = useState("");
  const [streamPhase, setStreamPhase] = useState<"idle" | "tools" | "text">("idle");
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea when panel opens
  useEffect(() => {
    if (open && !answer) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open, answer]);

  const ask = async (q: string) => {
    if (q.trim().length < 3) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setFeedbackGiven(null);
    setStreamText("");
    setStreamPhase("tools");
    setActiveTools([]);

    let accumulated = "";

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      const res = await fetch(`${apiBase}/api/ai/stream?q=${encodeURIComponent(q.trim())}`, {
        signal: ctrl.signal,
      });
      if (res.status === 429) {
        setError("הגעת למגבלת השאלות (10 לדקה). נסה שוב עוד דקה.");
        return;
      }
      if (!res.ok) throw new Error(`${res.status}`);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("no body");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw) as {
              type: string;
              tool?: string;
              chunk?: string;
              meta?: Omit<AiAnswer, "answer_md"> & { question: string };
              message?: string;
            };
            switch (event.type) {
              case "tool_start":
                setStreamPhase("tools");
                if (event.tool) setActiveTools((t) => [...new Set([...t, event.tool!])]);
                break;
              case "text_chunk":
                setStreamPhase("text");
                if (event.chunk) {
                  accumulated += event.chunk;
                  setStreamText(accumulated);
                }
                break;
              case "done":
                if (event.meta) setAnswer({ ...event.meta, answer_md: accumulated } as AiAnswer);
                break;
              case "error":
                setError(event.message ?? "שגיאה בחיבור ל-AI.");
                break;
            }
          } catch {
            /* malformed line */
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("שגיאה בחיבור ל-AI. נסה שנית.");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const sendFeedback = async (positive: boolean) => {
    if (!answer || feedbackGiven) return;
    setFeedbackGiven(positive ? "up" : "down");
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      void fetch(`${apiBase}/api/ai/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: answer.question, positive, model: answer.model }),
      });
    } catch {
      /* ignore */
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setAnswer(null);
    setError(null);
    setStreamText("");
    setStreamPhase("idle");
    setActiveTools([]);
    setQuestion(defaultQuestion);
    setFeedbackGiven(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  return (
    <div className="mt-4" dir="rtl">
      {/* Toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
          open
            ? "border-brand-300 bg-brand-50 text-brand-700"
            : "hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 border-neutral-200 bg-white text-neutral-600"
        }`}
        aria-expanded={open}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        שאל AI
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 opacity-60" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="border-brand-100 mt-2 rounded-lg border bg-white shadow-md">
          {/* Input area */}
          {!answer && (
            <div className="p-3">
              <div className="flex gap-2">
                <textarea
                  ref={textareaRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void ask(question);
                    }
                  }}
                  rows={2}
                  disabled={loading}
                  className="focus:border-brand-400 flex-1 resize-none rounded-md border border-neutral-200 px-3 py-2 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none disabled:opacity-60"
                  placeholder="שאל שאלה על ישות זו..."
                  dir="rtl"
                />
                <button
                  onClick={() => void ask(question)}
                  disabled={loading || question.trim().length < 3}
                  className="bg-brand-600 hover:bg-brand-700 shrink-0 self-end rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Streaming live panel */}
              {loading && (
                <div className="mt-2 rounded-md bg-neutral-50 p-2">
                  <div className="mb-1 flex items-center gap-1.5">
                    <Loader2 className="text-brand-500 h-3 w-3 animate-spin" />
                    <span className="text-[10px] text-neutral-500">
                      {streamPhase === "tools" ? "בודק נתונים..." : "מנסח תשובה..."}
                    </span>
                    {activeTools.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-neutral-200 px-1.5 py-0.5 font-mono text-[9px] text-neutral-600"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  {streamText && (
                    <p className="text-xs leading-relaxed text-neutral-700" dir="rtl">
                      {streamText}
                      <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-neutral-400" />
                    </p>
                  )}
                </div>
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setQuestion(s);
                        void ask(s);
                      }}
                      className="hover:border-brand-200 hover:text-brand-600 rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-500"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="mt-2 text-xs text-red-500">
                  {error}{" "}
                  <button onClick={() => void ask(question)} className="underline">
                    נסה שוב
                  </button>
                </p>
              )}
            </div>
          )}

          {/* Answer */}
          {answer && (
            <div>
              {/* Answer header */}
              <div className="from-brand-50 flex items-center justify-between border-b border-neutral-100 bg-gradient-to-l to-white px-4 py-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="text-brand-600 h-3.5 w-3.5" />
                  <span className="text-brand-700 text-xs font-semibold">תשובת AI</span>
                  <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
                    {answer.model}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Feedback */}
                  <button
                    onClick={() => void sendFeedback(true)}
                    aria-label="תשובה טובה"
                    className={`rounded p-1 ${feedbackGiven === "up" ? "bg-green-100 text-green-600" : "text-neutral-400 hover:text-green-500"}`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => void sendFeedback(false)}
                    aria-label="תשובה לא טובה"
                    className={`rounded p-1 ${feedbackGiven === "down" ? "bg-red-100 text-red-600" : "text-neutral-400 hover:text-red-500"}`}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                  {/* New question */}
                  <button
                    onClick={reset}
                    className="rounded p-1 text-neutral-400 hover:text-neutral-600"
                    aria-label="שאלה חדשה"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Answer body */}
              <div className="max-h-64 overflow-y-auto px-4 py-3">
                <div className="text-sm leading-relaxed text-neutral-800" dir="rtl">
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
                <div className="border-t border-neutral-100 px-4 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {answer.entity_cards.map((card: EntityCard) => (
                      <Link
                        key={card.url}
                        href={card.url}
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
                <div className="border-t border-neutral-100 px-4 py-2">
                  <div className="space-y-0.5">
                    {answer.citations.slice(0, 4).map((c, i) => (
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

              {/* Tool calls + disclaimer */}
              <div className="border-t border-neutral-100 bg-neutral-50 px-4 py-2">
                {answer.tool_calls_made.length > 0 && (
                  <p className="mb-1 text-[10px] text-neutral-400">
                    נבדק: <span className="font-mono">{answer.tool_calls_made.join(", ")}</span>
                  </p>
                )}
                <p className="text-[10px] text-neutral-400" dir="rtl">
                  {answer.disclaimer}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
