"use client";

/**
 * AdSlot — Google AdSense responsive ad unit.
 *
 * Rendered only in production and when env vars are present.
 * Disabled automatically:
 *   - In development (NODE_ENV !== 'production')
 *   - When NEXT_PUBLIC_ADSENSE_CLIENT is not set
 *   - When the slot prop is falsy
 *
 * Usage:
 *   <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_SEARCH} />
 */

import { useEffect, useRef } from "react";

interface AdSlotProps {
  slot?: string;
  /** Extra Tailwind classes for the outer wrapper */
  className?: string;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdSlot({ slot, className = "" }: AdSlotProps) {
  const initialized = useRef(false);
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  // Disabled in dev or if env vars are missing
  if (!client || !slot || process.env.NODE_ENV !== "production") {
    return null;
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle ?? []).push({});
    } catch {
      // silently ignore — happens when adsbygoogle is not loaded yet
    }
  }, []);

  return (
    <div
      className={`my-4 overflow-hidden text-center ${className}`}
      aria-label="פרסומת"
      role="complementary"
    >
      <p className="mb-1 text-xs text-neutral-400">פרסומת</p>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
