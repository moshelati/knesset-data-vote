import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },
        neutral: {
          50: "#fafafa",
          100: "#f5f5f5",
          200: "#e5e5e5",
          800: "#262626",
          900: "#171717",
        },
        confidence: {
          high: "#16a34a",
          medium: "#ca8a04",
          low: "#dc2626",
          unavailable: "#9ca3af",
        },
        status: {
          matched: "#16a34a",
          partial: "#ca8a04",
          no_match: "#6b7280",
          unavailable: "#9ca3af",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        hebrew: ["var(--font-heebo)", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
