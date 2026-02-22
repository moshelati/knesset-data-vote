"use client";

/**
 * QuestionTicker
 *
 * Animated rotating demo questions that entice the user to ask the AI.
 * Cycles through TICKER_QUESTIONS every ~4 seconds using CSS keyframe
 * animations (no framer-motion needed).
 *
 * Clicking a question fires `onSelect(question)` so the parent can
 * open the AiChatOverlay with that question pre-filled.
 */

import { useState, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { TICKER_QUESTIONS, DEMO_QUESTION_CATEGORY_COLORS } from "@knesset-vote/shared";
import type { DemoQuestion } from "@knesset-vote/shared";

interface QuestionTickerProps {
  /** Called when the user clicks a question */
  onSelect: (question: string) => void;
  /** Optional extra CSS classes */
  className?: string;
}

/**
 * Replace `___` placeholder with a styled pill span.
 * Returns an array of React nodes.
 */
function renderQuestionText(text: string, fill?: string): React.ReactNode {
  if (!text.includes("___")) return text;
  const parts = text.split("___");
  const displayFill = fill ?? "...";
  return (
    <>
      {parts[0]}
      <span className="mx-0.5 inline-block rounded-full bg-white/20 px-2 py-0.5 text-[0.8em] font-semibold text-white/90 ring-1 ring-white/30">
        {displayFill}
      </span>
      {parts[1]}
    </>
  );
}

export function QuestionTicker({ onSelect, className = "" }: QuestionTickerProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [animating, setAnimating] = useState(false);

  const questions = TICKER_QUESTIONS;

  const advance = useCallback(() => {
    setAnimating(true);
    // After fade-out, swap text and fade back in
    setTimeout(() => {
      setCurrentIdx((i) => (i + 1) % questions.length);
      setAnimating(false);
    }, 300);
  }, [questions.length]);

  useEffect(() => {
    const timer = setInterval(advance, 4000);
    return () => clearInterval(timer);
  }, [advance]);

  const current = questions[currentIdx] as DemoQuestion;
  const displayText = current.text.replace("___", current.defaultFill ?? "...");

  const handleClick = () => {
    onSelect(displayText);
  };

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`} dir="rtl">
      {/* Label */}
      <p className="flex items-center gap-1.5 text-sm font-medium text-white/70">
        <Sparkles className="h-3.5 w-3.5 text-white/60" aria-hidden="true" />
        שאלות לדוגמה — לחצו לנסות:
      </p>

      {/* Animated question pill */}
      <button
        onClick={handleClick}
        className={`group relative max-w-lg rounded-full border border-white/20 bg-white/10 px-5 py-2.5 text-center text-base font-medium text-white shadow-lg backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/20 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white/50 ${animating ? "translate-y-1 opacity-0" : "translate-y-0 opacity-100"} `}
        style={{ transition: "opacity 0.3s ease, transform 0.3s ease" }}
        aria-label={`שאל: ${displayText}`}
      >
        {renderQuestionText(current.text, current.defaultFill)}
      </button>

      {/* Dot navigation */}
      <div className="flex items-center gap-1.5" role="tablist" aria-label="שאלות לדוגמה">
        {questions.map((_q: DemoQuestion, i: number) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === currentIdx}
            aria-label={`שאלה ${i + 1}`}
            onClick={() => {
              setAnimating(true);
              setTimeout(() => {
                setCurrentIdx(i);
                setAnimating(false);
              }, 300);
            }}
            className={`h-1.5 rounded-full transition-all focus:outline-none focus:ring-1 focus:ring-white/50 ${i === currentIdx ? "w-4 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"} `}
          />
        ))}
      </div>

      {/* All questions grid — visible on wider screens */}
      <div className="mt-1 hidden flex-wrap justify-center gap-2 sm:flex">
        {questions.slice(0, 6).map((q: DemoQuestion, i: number) => {
          const fill = q.defaultFill ?? "...";
          const label = q.text.replace("___", fill);
          const colorClass = DEMO_QUESTION_CATEGORY_COLORS[q.category];
          return (
            <button
              key={i}
              onClick={() => onSelect(label)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${colorClass}`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
