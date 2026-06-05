import { useState, useEffect } from "react";

type Theme = "light" | "dark";

function getInitial(): Theme {
  const stored = localStorage.getItem("theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark"; // Jelly Glass is dark-native
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    // dark mode = no class (default); light mode = html.light
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggle };
}
