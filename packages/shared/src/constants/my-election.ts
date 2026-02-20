/**
 * Constants for the "My Election" (הבחירות שלי) personalized party-recommendation feature.
 *
 * GUARDRAILS:
 * 1. No ideological labeling — ideology chip is UI-only and NEVER used for scoring.
 * 2. Data-only — scores derived exclusively from legislative bill activity in DB.
 * 3. Every recommendation highlight must have SourceLink provenance.
 */

export const MY_ELECTION_TOPICS = [
  {
    id: "housing_prices",
    label_he: "הורדת מחירי הדיור",
    topic_keys: ["housing"] as string[],
    uiOnly: false,
  },
  {
    id: "personal_national_security",
    label_he: "ביטחון אישי/לאומי",
    topic_keys: ["security_defense"] as string[],
    uiOnly: false,
  },
  {
    id: "haredi_integration",
    label_he: 'שילוב חרדים בצה"ל / שירות לאומי',
    topic_keys: ["security_defense", "religion_state"] as string[],
    uiOnly: false,
  },
  {
    id: "transport_reform",
    label_he: "רפורמות תחבורה ציבורית",
    topic_keys: ["infrastructure"] as string[],
    uiOnly: false,
  },
  {
    id: "cost_of_living",
    label_he: "הורדת חסמי יבוא / יוקר המחיה",
    topic_keys: ["economy"] as string[],
    uiOnly: false,
  },
  {
    id: "healthcare",
    label_he: "בריאות",
    topic_keys: ["healthcare"] as string[],
    uiOnly: false,
  },
  {
    id: "education",
    label_he: "חינוך",
    topic_keys: ["education"] as string[],
    uiOnly: false,
  },
  {
    id: "religion_state",
    label_he: "דת ומדינה",
    topic_keys: ["religion_state"] as string[],
    uiOnly: false,
  },
  {
    id: "rule_of_law",
    label_he: "שלטון חוק / רפורמות משפטיות",
    topic_keys: ["justice_law"] as string[],
    uiOnly: false,
  },
  {
    id: "economy_innovation",
    label_he: "כלכלה/חדשנות",
    topic_keys: ["economy"] as string[],
    uiOnly: false,
  },
  // NOTE: ideology chip is UI-only; topic_keys is empty; NEVER used for scoring (guardrail 1)
  {
    id: "ideology",
    label_he: "העדפה אידאולוגית (ימין/מרכז/שמאל)",
    topic_keys: [] as string[],
    uiOnly: true,
  },
] as const;

export type MyElectionTopicId = (typeof MY_ELECTION_TOPICS)[number]["id"];

/** Points awarded per bill status in scoring */
export const BILL_STATUS_SCORE: Record<string, number> = {
  passed: 5,
  second_reading: 3,
  third_reading: 3,
  committee_review: 2,
  first_reading: 2,
  submitted: 1,
  draft: 0,
  rejected: 0,
  withdrawn: 0,
  expired: 0,
  unknown: 0,
};

/** Multiplier per MK role on a bill */
export const ROLE_MULTIPLIER: Record<string, number> = {
  initiator: 1.0,
  cosponsor: 0.5,
  committee: 0,
  other: 0,
};

/** Hebrew keyword → topic_id mapping used by free-text suggestions */
export const FREE_TEXT_KEYWORD_MAP: Array<{
  keywords: string[];
  topic_id: MyElectionTopicId;
}> = [
  {
    keywords: ['דיור', 'שכירות', 'דירה', 'משכנתה', 'נדל"ן'],
    topic_id: "housing_prices",
  },
  {
    keywords: ["ביטחון", "טרור", "משטרה", "פשע", "ביטחון אישי"],
    topic_id: "personal_national_security",
  },
  {
    keywords: ["חרדים", "גיוס", "שירות לאומי", "שירות צבאי", "ישיבה"],
    topic_id: "haredi_integration",
  },
  {
    keywords: ["תחבורה", "רכבת", "אוטובוס", "מטרו", "פקק", "אובר"],
    topic_id: "transport_reform",
  },
  {
    keywords: ["יוקר מחיה", "מחירים", "יבוא", "מונופול", "אינפלציה"],
    topic_id: "cost_of_living",
  },
  {
    keywords: ["בריאות", "רופא", "בית חולים", "תרופות", "קופת חולים"],
    topic_id: "healthcare",
  },
  {
    keywords: ["חינוך", "בית ספר", "מורה", "תלמיד", "אוניברסיטה"],
    topic_id: "education",
  },
  {
    keywords: ["דת", "מדינה", "כשרות", "שבת", "גיור", "רבנות"],
    topic_id: "religion_state",
  },
  {
    keywords: ['שלטון חוק', 'רפורמה משפטית', 'בג"ץ', "שופטים", "מינויים"],
    topic_id: "rule_of_law",
  },
  {
    keywords: ["כלכלה", "חדשנות", "היי-טק", "סטארטאפ", "מיסים", "תעסוקה"],
    topic_id: "economy_innovation",
  },
];
