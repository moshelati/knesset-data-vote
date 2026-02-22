/**
 * AI Demo Questions
 *
 * Curated Hebrew questions shown in the homepage QuestionTicker.
 * Questions use `___` as a placeholder for entity names that can be
 * replaced with real suggestions fetched from the API.
 *
 * Each question has a `category` for visual grouping and a `defaultFill`
 * that is shown when no entity suggestion is available.
 */

export interface DemoQuestion {
  /** The question text. May contain `___` as a placeholder. */
  text: string;
  /** Category for grouping / colour coding */
  category: "mk" | "party" | "bill" | "government" | "general";
  /** Fallback text that replaces `___` if no live suggestion is available */
  defaultFill?: string;
}

export const AI_DEMO_QUESTIONS: DemoQuestion[] = [
  // ── General ──────────────────────────────────────────────────────────
  {
    text: "מי שר האוצר הנוכחי?",
    category: "government",
  },
  {
    text: "כמה חברי כנסת יש לליכוד?",
    category: "party",
    defaultFill: "ליכוד",
  },
  {
    text: "מה ההצעת חוק האחרונה שהוגשה בנושא בריאות?",
    category: "bill",
  },
  {
    text: "מי ראש הממשלה הנוכחי?",
    category: "government",
  },
  {
    text: "כמה הצעות חוק הוגשו בכנסת ה-25?",
    category: "general",
  },

  // ── MK-focused ───────────────────────────────────────────────────────
  {
    text: "מה הפעילות החקיקתית של ___?",
    category: "mk",
    defaultFill: "בנימין נתניהו",
  },
  {
    text: "באילו ועדות כנסת חבר ___?",
    category: "mk",
    defaultFill: "יאיר לפיד",
  },
  {
    text: "כמה הצעות חוק הגיש ___ בכנסת הנוכחית?",
    category: "mk",
    defaultFill: "יצחק גולדקנופף",
  },
  {
    text: "האם ___ עבר בין סיעות?",
    category: "mk",
    defaultFill: "גדעון סער",
  },

  // ── Party-focused ─────────────────────────────────────────────────────
  {
    text: "כמה מנדטים יש ל___?",
    category: "party",
    defaultFill: "המחנה הממלכתי",
  },
  {
    text: 'מי הח"כים של ___?',
    category: "party",
    defaultFill: "יש עתיד",
  },
  {
    text: "האם ___ בקואליציה?",
    category: "party",
    defaultFill: 'ש"ס',
  },
  {
    text: "כמה חוקים העבירה ___ מאז הבחירות?",
    category: "party",
    defaultFill: "אופוזיציה",
  },

  // ── Bill-focused ──────────────────────────────────────────────────────
  {
    text: "מה מצב הצעת חוק ___?",
    category: "bill",
    defaultFill: "חוק הסדרת הייצוגיות",
  },
  {
    text: "מי הגיש הצעת חוק בנושא שכר מינימום?",
    category: "bill",
  },
  {
    text: "כמה הצעות חוק בנושא חינוך הוגשו השנה?",
    category: "bill",
  },

  // ── Government ────────────────────────────────────────────────────────
  {
    text: "מי שר הביטחון?",
    category: "government",
  },
  {
    text: "מי שר המשפטים הנוכחי?",
    category: "government",
  },
  {
    text: "מי שר הבריאות?",
    category: "government",
  },
  {
    text: "מהם תפקידי שר החוץ?",
    category: "government",
  },
  {
    text: "מי מכהן כשרים בממשלה הנוכחית?",
    category: "government",
  },
];

/** Subset used for the initial QuestionTicker animation (diverse + punchy) */
export const TICKER_QUESTIONS: DemoQuestion[] = [
  AI_DEMO_QUESTIONS[0]!, // מי שר האוצר?
  AI_DEMO_QUESTIONS[5]!, // פעילות חקיקתית של ___
  AI_DEMO_QUESTIONS[1]!, // כמה מנדטים לליכוד?
  AI_DEMO_QUESTIONS[14]!, // מי הגיש הצעת חוק שכר מינימום?
  AI_DEMO_QUESTIONS[16]!, // מי שר הביטחון?
  AI_DEMO_QUESTIONS[10]!, // מי הח"כים של ___
  AI_DEMO_QUESTIONS[2]!, // הצעת חוק אחרונה בריאות
  AI_DEMO_QUESTIONS[17]!, // מי שר המשפטים?
  AI_DEMO_QUESTIONS[8]!, // האם ___ עבר בין סיעות?
  AI_DEMO_QUESTIONS[12]!, // כמה חוקים העבירה ___
];

/** Category → Tailwind colour classes for pill badges */
export const DEMO_QUESTION_CATEGORY_COLORS: Record<DemoQuestion["category"], string> = {
  mk: "bg-brand-50 text-brand-700 border-brand-200",
  party: "bg-blue-50 text-blue-700 border-blue-200",
  bill: "bg-green-50 text-green-700 border-green-200",
  government: "bg-purple-50 text-purple-700 border-purple-200",
  general: "bg-neutral-50 text-neutral-700 border-neutral-200",
};
