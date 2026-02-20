import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

/**
 * Accessible breadcrumb navigation for detail pages.
 * RTL-aware: uses ChevronLeft as separator (visually → in RTL).
 *
 * Usage:
 *   <Breadcrumbs items={[
 *     { label: "ראשי", href: "/" },
 *     { label: "חברי כנסת", href: "/mks" },
 *     { label: mk.name_he },          // last item has no href → current page
 *   ]} />
 */
export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="פירורי לחם — מיקום בעמוד"
      className="mb-4 flex flex-wrap items-center gap-1 text-sm text-neutral-500"
    >
      <ol
        className="flex flex-wrap items-center gap-1"
        itemScope
        itemType="https://schema.org/BreadcrumbList"
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li
              key={index}
              className="flex items-center gap-1"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {index > 0 && (
                <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
              )}
              {isLast || !item.href ? (
                <span
                  className="max-w-[200px] truncate font-medium text-neutral-900"
                  aria-current="page"
                  itemProp="name"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-brand-700 max-w-[160px] truncate hover:underline"
                  itemProp="item"
                >
                  <span itemProp="name">{item.label}</span>
                </Link>
              )}
              <meta itemProp="position" content={String(index + 1)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
