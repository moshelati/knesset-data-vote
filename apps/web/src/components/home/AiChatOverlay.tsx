"use client";

/**
 * AiChatOverlay
 *
 * Full-screen AI chat overlay for the homepage.
 *
 * Layout:
 *  - Mobile  → slides up from bottom (CSS transform translateY)
 *  - Desktop → slides in from the right / centered modal
 *
 * Features:
 *  - Multi-turn conversation (messages array)
 *  - Streams answers via GET /api/ai/stream (SSE)
 *  - "Verified by data" badge when tool calls were made
 *  - Entity cards (MK / party / bill quick links)
 *  - Collapsible sources / citations
 *  - Follow-up input at the bottom
 *  - ESC + backdrop click to close
 *  - Focus trap (first interactive element on open)
 *  - RTL throughout
 */

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import Link from "next/link";
import {
  X,
  Sparkles,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Send,
} from "lucide-react";
import type { AiAnswer, EntityCard, Citation } from "@knesset-vote/shared";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Only present on assistant messages after streaming completes */
  answer?: AiAnswer;
  /** Live streaming text (before answer finalises) */
  streaming?: string;
  /** Which tools are being called right now */
  activeTools?: string[];
  /** Whether this message is still streaming */
  loading?: boolean;
  error?: string;
}

interface AiChatOverlayProps {
  /** Whether the overlay is visible */
  open: boolean;
  /** Close callback */
  onClose: () => void;
  /** Pre-fill the first question (e.g. from QuestionTicker) */
  initialQuestion?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ENTITY_CARD_COLORS: Record<string, string> = {
  mk: "bg-brand-50 border-brand-200 text-brand-800",
  party: "bg-blue-50 border-blue-200 text-blue-800",
  bill: "bg-green-50 border-green-200 text-green-800",
  minister: "bg-purple-50 border-purple-200 text-purple-800",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function VerifiedBadge({ toolCalls }: { toolCalls: string[] }) {
  if (toolCalls.length === 0) return null;
  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-md bg-green-50 px-2.5 py-1.5">
      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-green-600" aria-hidden="true" />
      <span className="text-[11px] font-medium text-green-700">
        אומת מנתוני הכנסת: <span className="font-mono">{toolCalls.join(", ")}</span>
      </span>
    </div>
  );
}

function EntityCards({ cards }: { cards: EntityCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {cards.map((card) => (
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
  );
}

function Citations({ citations }: { citations: Citation[] }) {
  const [expanded, setExpanded] = useState(false);
  if (citations.length === 0) return null;

  const shown = expanded ? citations : citations.slice(0, 2);

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="mb-1 flex items-center gap-1 text-[11px] font-medium text-neutral-400 hover:text-neutral-600"
      >
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        מקורות ({citations.length})
      </button>
      {expanded && (
        <div className="space-y-0.5">
          {shown.map((c, i) => (
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
      )}
    </div>
  );
}

function AssistantBubble({
  message,
  onFeedback,
}: {
  message: ChatMessage;
  onFeedback?: (positive: boolean) => void;
}) {
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(null);

  const handleFeedback = (positive: boolean) => {
    if (feedbackGiven) return;
    setFeedbackGiven(positive ? "up" : "down");
    onFeedback?.(positive);
  };

  return (
    <div className="flex items-start gap-2.5" dir="rtl">
      {/* Avatar */}
      <div className="from-brand-600 to-brand-800 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br">
        <Sparkles className="h-3.5 w-3.5 text-white" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        {/* Loading / tool call phase */}
        {message.loading && !message.streaming && (
          <div className="flex items-center gap-2 rounded-2xl rounded-tr-sm bg-neutral-100 px-4 py-3">
            <Loader2 className="text-brand-500 h-4 w-4 animate-spin" aria-label="טוען..." />
            <span className="text-sm text-neutral-500">
              {(message.activeTools?.length ?? 0) > 0
                ? `בודק נתונים: ${message.activeTools!.join(", ")}...`
                : "בודק נתונים..."}
            </span>
          </div>
        )}

        {/* Streaming or final text */}
        {(message.streaming || message.answer) && (
          <div className="rounded-2xl rounded-tr-sm bg-neutral-100 px-4 py-3">
            <div className="text-sm leading-relaxed text-neutral-800" dir="rtl">
              {(message.answer?.answer_md ?? message.streaming ?? "").split("\n").map((line, i) =>
                line.trim() ? (
                  <p key={i} className="mb-1.5 last:mb-0">
                    {line}
                  </p>
                ) : null,
              )}
              {/* Typing cursor while streaming */}
              {message.loading && (
                <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-neutral-400" />
              )}
            </div>

            {/* After stream completes */}
            {message.answer && (
              <>
                <VerifiedBadge toolCalls={message.answer.tool_calls_made} />
                <EntityCards cards={message.answer.entity_cards} />
                <Citations citations={message.answer.citations} />

                {/* Disclaimer */}
                <p className="mt-2 text-[10px] text-neutral-400" dir="rtl">
                  {message.answer.disclaimer}
                </p>

                {/* Feedback */}
                <div className="mt-2 flex items-center gap-1">
                  <span className="text-[10px] text-neutral-400">האם התשובה מועילה?</span>
                  <button
                    onClick={() => handleFeedback(true)}
                    aria-label="תשובה מועילה"
                    className={`rounded p-1 ${feedbackGiven === "up" ? "bg-green-100 text-green-600" : "text-neutral-300 hover:text-green-500"}`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleFeedback(false)}
                    aria-label="תשובה לא מועילה"
                    className={`rounded p-1 ${feedbackGiven === "down" ? "bg-red-100 text-red-600" : "text-neutral-300 hover:text-red-500"}`}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Error state */}
        {message.error && (
          <div className="rounded-2xl rounded-tr-sm bg-red-50 px-4 py-3">
            <p className="text-sm text-red-600">{message.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AiChatOverlay({ open, onClose, initialQuestion = "" }: AiChatOverlayProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(initialQuestion);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to latest message
  const scrollToBottom = useCallback(() => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  // Focus input on open; auto-submit if initialQuestion given
  useEffect(() => {
    if (!open) return;
    setInput(initialQuestion);
    setTimeout(() => inputRef.current?.focus(), 100);
    if (initialQuestion.trim().length >= 3) {
      // Submit on next tick so state has settled
      setTimeout(() => sendMessage(initialQuestion), 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialQuestion]);

  // ESC to close
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const sendFeedback = useCallback(async (question: string, positive: boolean, model: string) => {
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
      void fetch(`${apiBase}/api/ai/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, positive, model }),
      });
    } catch {
      /* ignore */
    }
  }, []);

  const sendMessage = useCallback(
    async (q: string) => {
      const text = q.trim();
      if (text.length < 3) return;

      // Abort any in-flight request
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      // Add user message
      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", text };
      const assistantId = `a-${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        text: "",
        loading: true,
        activeTools: [],
      };

      setMessages((m) => [...m, userMsg, assistantMsg]);
      setInput("");
      scrollToBottom();

      let accumulated = "";

      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
        const res = await fetch(`${apiBase}/api/ai/stream?q=${encodeURIComponent(text)}`, {
          signal: ctrl.signal,
        });

        if (res.status === 429) {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, loading: false, error: "הגעת למגבלת 10 שאלות לדקה. נסה שוב עוד דקה." }
                : msg,
            ),
          );
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
                  setMessages((m) =>
                    m.map((msg) =>
                      msg.id === assistantId && event.tool
                        ? {
                            ...msg,
                            activeTools: [...new Set([...(msg.activeTools ?? []), event.tool!])],
                          }
                        : msg,
                    ),
                  );
                  break;

                case "text_chunk":
                  if (event.chunk) {
                    accumulated += event.chunk;
                    setMessages((m) =>
                      m.map((msg) =>
                        msg.id === assistantId
                          ? { ...msg, streaming: accumulated, activeTools: [] }
                          : msg,
                      ),
                    );
                    scrollToBottom();
                  }
                  break;

                case "done":
                  if (event.meta) {
                    const finalAnswer: AiAnswer = { ...event.meta, answer_md: accumulated };
                    setMessages((m) =>
                      m.map((msg) =>
                        msg.id === assistantId
                          ? { ...msg, loading: false, streaming: undefined, answer: finalAnswer }
                          : msg,
                      ),
                    );
                    scrollToBottom();
                  }
                  break;

                case "error":
                  setMessages((m) =>
                    m.map((msg) =>
                      msg.id === assistantId
                        ? {
                            ...msg,
                            loading: false,
                            error: event.message ?? "שגיאה בחיבור ל-AI.",
                          }
                        : msg,
                    ),
                  );
                  break;
              }
            } catch {
              /* malformed line */
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, loading: false, error: "שגיאה בחיבור ל-AI. נסה שנית." }
                : msg,
            ),
          );
        }
      } finally {
        abortRef.current = null;
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId && msg.loading ? { ...msg, loading: false } : msg,
          ),
        );
      }
    },
    [scrollToBottom],
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const isAnyLoading = messages.some((m) => m.loading);

  const handleClose = () => {
    abortRef.current?.abort();
    onClose();
    // Slight delay before clearing so close animation plays
    setTimeout(() => setMessages([]), 300);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
        style={{ animation: "fadeIn 0.2s ease" }}
      />

      {/* Panel — slide-up on mobile, centred modal on desktop */}
      <div
        ref={overlayRef}
        role="dialog"
        aria-modal="true"
        aria-label="שאל AI על הכנסת"
        dir="rtl"
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col rounded-t-2xl bg-white shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
        style={{ animation: "slideUp 0.3s cubic-bezier(0.32,0.72,0,1)" }}
      >
        {/* Header */}
        <div className="from-brand-600 to-brand-800 flex items-center justify-between rounded-t-2xl bg-gradient-to-l px-5 py-3.5 sm:rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
            <span className="font-semibold text-white">שאל AI על הכנסת</span>
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] text-white/80">
              Gemini 2.0 Flash
            </span>
          </div>
          <button
            onClick={handleClose}
            aria-label="סגור"
            className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="from-brand-100 to-brand-50 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br">
                <Sparkles className="text-brand-500 h-8 w-8" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-neutral-700">שאל שאלה על הכנסת</p>
                <p className="mt-1 text-sm text-neutral-400">
                  כל תשובה מבוססת אך ורק על נתוני מסד הנתונים הרשמי
                </p>
              </div>
            </div>
          )}

          <div className="space-y-5">
            {messages.map((msg) =>
              msg.role === "user" ? (
                /* User bubble — right-aligned in RTL = left margin */
                <div key={msg.id} className="flex justify-start" dir="rtl">
                  <div className="bg-brand-600 max-w-[80%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-white">
                    {msg.text}
                  </div>
                </div>
              ) : (
                <AssistantBubble
                  key={msg.id}
                  message={msg}
                  onFeedback={(positive) => {
                    const q = messages.find(
                      (m, i) => m.role === "user" && messages[i + 1]?.id === msg.id,
                    );
                    const model = msg.answer?.model ?? "gemini-2.0-flash";
                    void sendFeedback(q?.text ?? "", positive, model);
                  }}
                />
              ),
            )}
          </div>
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-neutral-200 bg-white px-4 py-3 sm:rounded-b-2xl">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={isAnyLoading}
              placeholder={
                messages.length === 0 ? 'שאל שאלה על הכנסת, ח"כים, הצעות חוק...' : "שאלת המשך..."
              }
              className="focus:border-brand-400 flex-1 resize-none rounded-xl border border-neutral-200 px-3 py-2 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none disabled:opacity-60"
              dir="rtl"
              aria-label="שאלה"
            />
            <button
              onClick={() => void sendMessage(input)}
              disabled={isAnyLoading || input.trim().length < 3}
              aria-label="שלח"
              className="bg-brand-600 hover:bg-brand-700 shrink-0 rounded-xl p-2.5 text-white shadow-sm disabled:opacity-50"
            >
              {isAnyLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-neutral-400">
            AI עשוי לטעות · כל טענה מאומתת מנתוני הכנסת · מגבלה: 10 שאלות לדקה
          </p>
        </div>
      </div>

      {/* CSS keyframes injected inline */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0.6; }
          to   { transform: translateY(0);    opacity: 1;   }
        }
        @media (min-width: 640px) {
          @keyframes slideUp {
            from { transform: translate(-50%, -40%); opacity: 0.6; }
            to   { transform: translate(-50%, -50%); opacity: 1;   }
          }
        }
      `}</style>
    </>
  );
}
