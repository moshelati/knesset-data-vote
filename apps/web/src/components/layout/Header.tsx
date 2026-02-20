import Link from "next/link";
import { Search } from "lucide-react";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="text-brand-700 flex items-center gap-2 font-bold">
            <span className="text-xl">🏛</span>
            <span className="hidden text-lg sm:block">Knesset Vote</span>
            <span className="text-xs font-normal text-neutral-500">נתוני כנסת שקופים</span>
          </Link>

          {/* Navigation */}
          <nav aria-label="Navigation" className="hidden gap-6 md:flex">
            <Link
              href="/parties"
              className="hover:text-brand-700 text-sm font-medium text-neutral-600"
            >
              סיעות
            </Link>
            <Link href="/mks" className="hover:text-brand-700 text-sm font-medium text-neutral-600">
              חברי כנסת
            </Link>
            <Link
              href="/bills"
              className="hover:text-brand-700 text-sm font-medium text-neutral-600"
            >
              הצעות חוק
            </Link>
            <Link
              href="/votes"
              className="hover:text-brand-700 text-sm font-medium text-neutral-600"
            >
              הצבעות
            </Link>
            <Link
              href="/my-election"
              className="text-brand-700 hover:text-brand-900 text-sm font-semibold"
            >
              הבחירות שלי
            </Link>
            <Link
              href="/methodology"
              className="hover:text-brand-700 text-sm font-medium text-neutral-600"
            >
              מתודולוגיה
            </Link>
          </nav>

          {/* Search button */}
          <Link
            href="/?focus=search"
            className="flex items-center gap-2 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100"
            aria-label="חיפוש"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">חפש...</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
