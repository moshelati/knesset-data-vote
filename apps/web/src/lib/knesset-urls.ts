/**
 * Helpers for constructing official Knesset website deep-links.
 * Base URL: https://main.knesset.gov.il
 *
 * These are informational links only — this project does not scrape or claim
 * affiliation with the official Knesset website.
 */

export const KNESSET_HOME_URL = "https://www.knesset.gov.il";
export const KNESSET_ODATA_BASE_URL =
  "https://knesset.gov.il/Odata/ParliamentInfo.svc";

/**
 * Deep-link to an MK's personal page on the official Knesset website.
 * Pattern: https://main.knesset.gov.il/mk/apps/mk/mk-personal-details/{externalId}
 *
 * @param externalId  The numeric external_id from KNS_Person OData (e.g. "903")
 * @returns URL string, or null if externalId is falsy
 */
export function mkOfficialUrl(externalId: string | number | null | undefined): string | null {
  if (!externalId) return null;
  return `https://main.knesset.gov.il/mk/apps/mk/mk-personal-details/${externalId}`;
}

/**
 * Deep-link to a bill (KNS_Bill) on the official Knesset website.
 * Pattern: https://main.knesset.gov.il/activity/legislation/laws/pages/billdetails.aspx?t=lawsuggestionssearch&lawitemid={externalId}
 */
export function billOfficialUrl(externalId: string | number | null | undefined): string | null {
  if (!externalId) return null;
  return `https://main.knesset.gov.il/activity/legislation/laws/pages/billdetails.aspx?t=lawsuggestionssearch&lawitemid=${externalId}`;
}

/**
 * Deep-link to a faction (KNS_Faction) on the official Knesset website.
 * Pattern: https://main.knesset.gov.il/mk/apps/mk/faction-details/{externalId}
 */
export function factionOfficialUrl(externalId: string | number | null | undefined): string | null {
  if (!externalId) return null;
  return `https://main.knesset.gov.il/mk/apps/mk/faction-details/${externalId}`;
}
