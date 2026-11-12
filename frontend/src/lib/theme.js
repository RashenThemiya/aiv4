export const THEME_STORAGE_KEY = "pentarix-theme";
export const THEME_MODES = ["light", "dark"];

export function getInitialThemeMode() {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return THEME_MODES.includes(stored) ? stored : "light";
  } catch {
    return "light";
  }
}

export function resolveThemeMode(mode) {
  return mode === "dark" ? "dark" : "light";
}

export function applyThemeMode(mode, { persist = true } = {}) {
  const safeMode = THEME_MODES.includes(mode) ? mode : "light";
  const resolved = resolveThemeMode(safeMode);
  const root = document.documentElement;

  root.classList.toggle("dark", resolved === "dark");
  root.dataset.theme = resolved;
  root.dataset.themeMode = safeMode;
  root.style.colorScheme = resolved;

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute("content", resolved === "dark" ? "#07111f" : "#f4f7f6");

  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, safeMode);
    } catch {
      // Storage may be unavailable in private or embedded contexts.
    }
  }

  return resolved;
}
