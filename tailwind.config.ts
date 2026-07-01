import type { Config } from "tailwindcss";
import preset from "./tailwind-preset";

const config: Config = {
  presets: [preset],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/ui/**/*.{ts,tsx}"],
};

export default config;
