import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";
import forms from "@tailwindcss/forms";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Command Center Palette (V2)
        command: {
          sidebar: "#0F172A",   // Slate-900 (Dark Navy Sidebar)
          header: "#FCE7F3",    // Pink-100 (Pale Pink Header)
          active: "#2563EB",    // Blue-600 (Vivid Blue Active State)
          bg: "#FFFFFF",        // Clean White Background
        },
        // Widget Accents
        tactix: "#3B82F6",      // Blue
        insight: "#A855F7",     // Purple
        pipeline: "#22C55E",    // Green
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grid-pattern":
          "linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        marquee: "marquee 30s linear infinite",
      },
    },
  },
  plugins: [typography, forms],
};

export default config;
