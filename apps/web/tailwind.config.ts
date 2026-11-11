import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: { DEFAULT: "1rem", sm: "1.25rem" }, screens: { "2xl": "1180px" } },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: { DEFAULT: "hsl(var(--primary))", foreground: "hsl(var(--primary-foreground))" },
        secondary: { DEFAULT: "hsl(var(--secondary))", foreground: "hsl(var(--secondary-foreground))" },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted: { DEFAULT: "hsl(var(--muted))", foreground: "hsl(var(--muted-foreground))" },
        accent: { DEFAULT: "hsl(var(--accent))", foreground: "hsl(var(--accent-foreground))" },
        card: { DEFAULT: "hsl(var(--card))", foreground: "hsl(var(--card-foreground))" },
        warning: "hsl(var(--warning))",
        success: "hsl(var(--success))",
        highlight: { DEFAULT: "hsl(var(--highlight))", foreground: "hsl(var(--highlight-foreground))" },
        popover: { DEFAULT: "hsl(var(--popover))", foreground: "hsl(var(--popover-foreground))" },
      },
      borderRadius: { lg: "calc(var(--radius) + 2px)", md: "var(--radius)", sm: "calc(var(--radius) - 2px)" },
      fontFamily: {
        // Display: editorial serif for headlines and quit stories.
        display: ['"Source Serif 4 Variable"', "Georgia", "serif"],
        // UI and body text.
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        // Structured "form" data: company, time served, stamps.
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        // Type scale (1.2 ratio), rem-based so browser zoom works.
        micro: ["0.6875rem", { lineHeight: "1rem" }],      // 11
        xs: ["0.75rem", { lineHeight: "1.1rem" }],         // 12
        sm: ["0.8125rem", { lineHeight: "1.25rem" }],      // 13
        base: ["0.9375rem", { lineHeight: "1.55rem" }],    // 15
        lg: ["1.0625rem", { lineHeight: "1.6rem" }],       // 17
        xl: ["1.25rem", { lineHeight: "1.65rem" }],        // 20
        "2xl": ["1.5rem", { lineHeight: "1.9rem" }],       // 24
        "3xl": ["1.875rem", { lineHeight: "2.2rem" }],     // 30
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],      // 36
      },
    },
  },
  plugins: [animate],
} satisfies Config;
