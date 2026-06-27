import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        stage: {
          bg: "rgb(var(--stage-bg) / <alpha-value>)",
          surface: "rgb(var(--stage-surface) / <alpha-value>)",
          border: "rgb(var(--stage-border) / <alpha-value>)",
          text: "rgb(var(--stage-text) / <alpha-value>)",
          accent: "rgb(var(--stage-accent) / <alpha-value>)",
          "accent-hover": "rgb(var(--stage-accent-hover) / <alpha-value>)",
          pro: "rgb(var(--stage-pro) / <alpha-value>)",
          con: "rgb(var(--stage-con) / <alpha-value>)",
          muted: "rgb(var(--stage-muted) / <alpha-value>)",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
    },
  },
  plugins: [],
};

export default config;
