/**
 * SSRF Prevention Guard
 *
 * All outbound HTTP fetches in the ETL must pass through this guard.
 * Only domains in the allowlist may be fetched.
 */

const DEFAULT_ALLOWED_DOMAINS = ["knesset.gov.il", "gov.il", "main.knesset.gov.il"];

function getAllowedDomains(): string[] {
  const envDomains = process.env["ALLOWED_FETCH_DOMAINS"];
  if (envDomains) {
    return envDomains.split(",").map((d) => d.trim().toLowerCase());
  }
  return DEFAULT_ALLOWED_DOMAINS;
}

export function assertAllowedUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Only allow HTTPS in production
  if (process.env["NODE_ENV"] === "production" && parsed.protocol !== "https:") {
    throw new Error(`Only HTTPS URLs are allowed in production. Got: ${url}`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowedDomains = getAllowedDomains();

  const isAllowed = allowedDomains.some(
    (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
  );

  if (!isAllowed) {
    throw new Error(
      `SSRF protection: URL hostname "${hostname}" is not in the allowlist. ` +
        `Allowed: ${allowedDomains.join(", ")}`,
    );
  }
}

export async function safeFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  assertAllowedUrl(url);
  return fetch(url, {
    ...options,
    headers: {
      "User-Agent": "KnessetVote-ETL/1.0 (data-transparency-project)",
      ...options?.headers,
    },
  });
}
