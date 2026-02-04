"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function getTheme(): Theme {
  const v = document.documentElement.dataset.theme;
  return v === "light" ? "light" : "dark";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("wf_theme", theme);
  } catch {
    // ignore
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(getTheme());
  }, []);

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => {
        const next: Theme = theme === "dark" ? "light" : "dark";
        applyTheme(next);
        setTheme(next);
      }}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {theme === "dark" ? "Dark" : "Light"}
    </button>
  );
}

