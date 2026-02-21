import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { GovBar } from "@/components/layout/GovBar";

export const metadata: Metadata = {
  title: {
    default: "Knesset Vote - Israeli Parliamentary Data",
    template: "%s | Knesset Vote",
  },
  description:
    "Transparent, source-linked parliamentary data for Israeli voters. " +
    "Evaluate MKs and parties using verifiable Knesset data.",
  keywords: ["כנסת", "בחירות", "חברי כנסת", "חקיקה", "שקיפות פרלמנטרית"],
  openGraph: {
    type: "website",
    locale: "he_IL",
    alternateLocale: ["en_US"],
    siteName: "Knesset Vote",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-3367061678299382";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&family=Assistant:wght@400;500;600;700&family=Noto+Sans+Hebrew:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Google AdSense — verification + ad loading (native script tag for crawler visibility) */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </head>
      <body>
        {/* Skip to main content for a11y */}
        <a href="#main-content" className="skip-link">
          דלג לתוכן הראשי
        </a>

        <div className="flex min-h-screen flex-col">
          <GovBar />
          <Header />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
