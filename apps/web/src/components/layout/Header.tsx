"use client";

import Link from "next/link";
import { Search, Menu, X } from "lucide-react";
import { useState } from "react";
import { GlobalSearch } from "@/components/shared/GlobalSearch";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const navLinks = [
    { href: "/parties", label: "סיעות" },
    { href: "/mks", label: "חברי כנסת" },
    { href: "/government", label: "ממשלה" },
    { href: "/bills", label: "הצעות חוק" },
    { href: "/votes", label: "הצבעות" },
    { href: "/my-election", label: "הבחירות שלי", bold: true },
    { href: "/methodology", label: "מתודולוגיה" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="text-brand-700 flex shrink-0 items-center gap-2 font-bold">
            <span className="text-xl">🏛</span>
            <span className="hidden text-lg sm:block">Knesset Vote</span>
            <span className="hidden text-xs font-normal text-neutral-500 lg:block">
              נתוני כנסת שקופים
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Navigation" className="hidden gap-5 xl:flex">
            {navLinks.map(({ href, label, bold }) => (
              <Link
                key={href}
                href={href}
                className={
                  bold
                    ? "text-brand-700 hover:text-brand-900 text-sm font-semibold"
                    : "hover:text-brand-700 text-sm font-medium text-neutral-600"
                }
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* GlobalSearch — desktop (md+) */}
            <div className="hidden w-56 md:block lg:w-72">
              <GlobalSearch />
            </div>

            {/* Mobile search toggle */}
            <button
              className="flex items-center justify-center rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 md:hidden"
              aria-label={mobileSearchOpen ? "סגור חיפוש" : "פתח חיפוש"}
              onClick={() => {
                setMobileSearchOpen((v) => !v);
                setMenuOpen(false);
              }}
            >
              <Search className="h-5 w-5" />
            </button>

            {/* Mobile hamburger */}
            <button
              className="flex items-center justify-center rounded-lg p-2 text-neutral-600 hover:bg-neutral-100 md:hidden"
              aria-label={menuOpen ? "סגור תפריט" : "פתח תפריט"}
              aria-expanded={menuOpen}
              onClick={() => {
                setMenuOpen((v) => !v);
                setMobileSearchOpen(false);
              }}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile search bar */}
      {mobileSearchOpen && (
        <div className="border-t border-neutral-200 bg-white px-4 py-3 md:hidden">
          <GlobalSearch />
        </div>
      )}

      {/* Mobile nav menu */}
      {menuOpen && (
        <div className="border-t border-neutral-200 bg-white md:hidden">
          <nav className="flex flex-col px-4 py-3" aria-label="תפריט ניווט">
            {navLinks.map(({ href, label, bold }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-3 text-sm font-medium ${
                  bold ? "text-brand-700 font-semibold" : "text-neutral-700 hover:bg-neutral-50"
                }`}
                onClick={() => setMenuOpen(false)}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
