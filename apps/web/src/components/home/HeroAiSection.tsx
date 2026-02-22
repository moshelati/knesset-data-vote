"use client";

/**
 * HeroAiSection — Client wrapper for the AI interactive parts of the homepage hero.
 *
 * Contains:
 *  - "שאל AI" pill button that opens AiChatOverlay
 *  - QuestionTicker (animated rotating demo questions)
 *  - AiChatOverlay (full-screen chat, slides up on click / ticker select)
 *
 * Kept separate so the parent HomePage can remain a Server Component.
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { QuestionTicker } from "./QuestionTicker";
import { AiChatOverlay } from "./AiChatOverlay";

export function HeroAiSection() {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");

  const openWithQuestion = (q: string) => {
    setPendingQuestion(q);
    setOverlayOpen(true);
  };

  const openEmpty = () => {
    setPendingQuestion("");
    setOverlayOpen(true);
  };

  return (
    <>
      {/* AI CTA button */}
      <button
        onClick={openEmpty}
        className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
        aria-label="פתח שיח AI"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        שאל AI על הכנסת
        <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/80">
          חדש
        </span>
      </button>

      {/* Animated question ticker */}
      <QuestionTicker onSelect={openWithQuestion} className="mt-5" />

      {/* Full-screen chat overlay */}
      <AiChatOverlay
        open={overlayOpen}
        onClose={() => setOverlayOpen(false)}
        initialQuestion={pendingQuestion}
      />
    </>
  );
}
