export type ColorTheme = "dark" | "light";

export const COLOR_THEME_STORAGE_KEY = "adadex.colorTheme";

export const isColorTheme = (value: unknown): value is ColorTheme =>
  value === "dark" || value === "light";

export const readColorThemePreference = (): ColorTheme => {
  if (typeof window === "undefined") {
    return "dark";
  }

  try {
    const stored = window.localStorage.getItem(COLOR_THEME_STORAGE_KEY);
    return isColorTheme(stored) ? stored : "dark";
  } catch {
    return "dark";
  }
};

export const writeColorThemePreference = (theme: ColorTheme): void => {
  try {
    window.localStorage.setItem(COLOR_THEME_STORAGE_KEY, theme);
  } catch {
    // Browser storage can be disabled.
  }
};

export const applyColorThemeToDocument = (theme: ColorTheme): void => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("light", theme === "light");
  root.classList.toggle("adadex-theme-light", theme === "light");
  root.style.colorScheme = theme;
};
