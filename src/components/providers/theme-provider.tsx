"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";
interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("system");

  // hydrate from storage
  useEffect(() => {
    const stored = (localStorage.getItem("ptopup-theme") as Theme | null) ?? "system";
    setTheme(stored);
  }, []);

  // apply class to <html>
  useEffect(() => {
    const root = document.documentElement;
    const apply = (t: Theme) => {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const isDark = t === "dark" || (t === "system" && mql.matches);
      root.classList.toggle("dark", isDark);
    };
    apply(theme);
    localStorage.setItem("ptopup-theme", theme);

    if (theme === "system") {
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = () => apply("system");
      mql.addEventListener("change", handler);
      return () => mql.removeEventListener("change", handler);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
