// Knesset OData API base URLs
// v4 is the new recommended API (launched 2024). v2 is deprecated and will be shut down.
export const KNESSET_ODATA_BASE = "https://knesset.gov.il/OdataV4/ParliamentInfo";
export const KNESSET_ODATA_METADATA = `${KNESSET_ODATA_BASE}/$metadata`;
// Keep v2 reference for source_url compatibility (existing DB records)
export const KNESSET_ODATA_V2_BASE = "https://knesset.gov.il/Odata/ParliamentInfo.svc";

// Allowed domains for outbound fetches (SSRF prevention)
export const ALLOWED_FETCH_DOMAINS = ["knesset.gov.il", "gov.il", "main.knesset.gov.il"] as const;

// Cache TTLs (seconds)
export const CACHE_TTL = {
  SHORT: 60,
  MEDIUM: 300,
  LONG: 3600,
  METADATA: 86400,
} as const;

// Rate limiting
export const RATE_LIMIT = {
  MAX_REQUESTS: 100,
  TIME_WINDOW_MS: 60_000,
} as const;

// ETL concurrency
export const ETL_CONCURRENCY = 3;
export const ETL_RETRY_MAX = 3;
export const ETL_RETRY_DELAY_MS = 1000;
export const ETL_PAGE_SIZE = 50;
export const ETL_REQUEST_DELAY_MS = 300; // be polite to the API

// Knesset current session
export const CURRENT_KNESSET_NUMBER = 25;

export const METHODOLOGY_VERSION = "1.0.0";

// Hebrew display labels for bill topics (UI: Hebrew)
// Note: BILL_TOPIC_LABELS (English) is in schemas/bill.ts
export const BILL_TOPIC_LABELS_HE: Record<string, string> = {
  economy: "כלכלה ומיסוי",
  security_defense: "ביטחון והגנה",
  social_welfare: "רווחה חברתית",
  healthcare: "בריאות",
  education: "חינוך",
  environment: "סביבה ואקלים",
  justice_law: "משפט וחוק",
  foreign_affairs: "יחסי חוץ",
  housing: 'דיור ונדל"ן',
  infrastructure: "תשתיות ותחבורה",
  religion_state: "דת ומדינה",
  immigration: "עלייה והגירה",
  civil_rights: "זכויות אזרחיות",
  local_government: "שלטון מקומי",
  other: "אחר",
};

// Topic keyword mappings for static tagging
export const TOPIC_KEYWORDS: Record<string, string[]> = {
  economy: ["כלכלה", "מס", "תקציב", "אוצר", "מיסוי", "פיננסי", "בנק"],
  security_defense: [
    "ביטחון",
    "צבא",
    "הגנה",
    "מיליטרי",
    "ביטחון לאומי",
    "חרדים",
    "שירות לאומי",
    "גיוס",
  ],
  social_welfare: ["רווחה", "סיוע", "קצבה", "עוני", "שוויון חברתי"],
  healthcare: ["בריאות", "רפואה", "בית חולים", "תרופה", "רופא"],
  education: ["חינוך", "בית ספר", "אוניברסיטה", "תלמיד", "מורה"],
  environment: ["סביבה", "אקלים", "זיהום", "אנרגיה", "טבע"],
  justice_law: ["משפט", "עונשין", "פלילי", "אזרחי", "שופט", "בית משפט"],
  foreign_affairs: ["חוץ", "דיפלומטי", "בינלאומי", "אמנה", "שגריר"],
  housing: ["דיור", "שכירות", "דירה", "נדל", "בנייה"],
  infrastructure: ["תשתית", "כביש", "רכבת", "תחבורה", "חשמל"],
  religion_state: ["דת", "מדינה", "הלכה", "כשרות", "שבת", "דתי", "שירות לאומי", "גיוס חרדים"],
  immigration: ["עלייה", "הגירה", "פליט", "אזרחות"],
  civil_rights: ["זכויות", "אזרחי", "חופש", "ביטוי", "שוויון"],
  local_government: ["עירייה", "מועצה", "מקומי", "רשות"],
};

// ─────────────────────────────────────────────
// Ministry → Topic mapping (manual curation)
// Maps Knesset GovMinistryID → { name_he, topic }
// Source: KNS_GovMinistry + KNS_PersonToPosition + manual attribution
// Labeled as "manual" per methodology transparency requirement
// ─────────────────────────────────────────────
export const MINISTRY_TOPIC_MAP: Record<string, { name_he: string; topic: string }> = {
  "568":  { name_he: "משרד ראש הממשלה", topic: "other" },
  "583":  { name_he: "משרד ירושלים ומסורת ישראל", topic: "religion_state" },
  "589":  { name_he: "משרד התרבות והספורט", topic: "other" },
  "618":  { name_he: "משרד התקשורת", topic: "infrastructure" },
  "628":  { name_he: "משרד התפוצות והמאבק באנטישמיות", topic: "foreign_affairs" },
  "654":  { name_he: "משרד התיירות", topic: "economy" },
  "686":  { name_he: "משרד התחבורה והבטיחות בדרכים", topic: "infrastructure" },
  "711":  { name_he: "משרד הרווחה והביטחון החברתי", topic: "social_welfare" },
  "722":  { name_he: "משרד הקשר בין הממשלה לכנסת", topic: "other" },
  "803":  { name_he: "משרד העלייה והקליטה", topic: "immigration" },
  "830":  { name_he: "משרד העבודה", topic: "social_welfare" },
  "844":  { name_he: "משרד הנגב, הגליל והחוסן הלאומי", topic: "local_government" },
  "876":  { name_he: "משרד המשפטים", topic: "justice_law" },
  "884":  { name_he: "משרד המורשת", topic: "religion_state" },
  "922":  { name_he: "משרד הכלכלה והתעשייה", topic: "economy" },
  "967":  { name_he: "משרד החקלאות וביטחון המזון", topic: "economy" },
  "1004": { name_he: "משרד החינוך", topic: "education" },
  "1042": { name_he: "משרד החוץ", topic: "foreign_affairs" },
  "1067": { name_he: "משרד החדשנות, המדע והטכנולוגיה", topic: "economy" },
  "1070": { name_he: "משרד ההתיישבות והמשימות הלאומיות", topic: "local_government" },
  "1112": { name_he: "משרד הבריאות", topic: "healthcare" },
  "1146": { name_he: "משרד הבינוי והשיכון", topic: "housing" },
  "1178": { name_he: "משרד הביטחון", topic: "security_defense" },
  "1205": { name_he: "משרד האנרגיה והתשתיות", topic: "infrastructure" },
  "1237": { name_he: "משרד האוצר", topic: "economy" },
  "1251": { name_he: "המשרד לשיתוף פעולה אזורי", topic: "foreign_affairs" },
  "1283": { name_he: "המשרד לשירותי דת", topic: "religion_state" },
  "1297": { name_he: "המשרד לשוויון חברתי וקידום מעמד האישה", topic: "civil_rights" },
  "1332": { name_he: "המשרד להגנת הסביבה", topic: "environment" },
  "1361": { name_he: "המשרד לביטחון לאומי", topic: "security_defense" },
};
