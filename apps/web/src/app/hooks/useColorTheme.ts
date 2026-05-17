import { useCallback, useEffect, useState } from "react";

import {
  type ColorTheme,
  applyColorThemeToDocument,
  readColorThemePreference,
  writeColorThemePreference,
} from "../colorTheme";

type UseColorThemeResult = {
  colorTheme: ColorTheme;
  isLight: boolean;
  setColorTheme: (theme: ColorTheme) => void;
  toggleColorTheme: () => void;
};

export const useColorTheme = (): UseColorThemeResult => {
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(readColorThemePreference);

  useEffect(() => {
    applyColorThemeToDocument(colorTheme);
  }, [colorTheme]);

  const setColorTheme = useCallback((theme: ColorTheme) => {
    writeColorThemePreference(theme);
    setColorThemeState(theme);
  }, []);

  const toggleColorTheme = useCallback(() => {
    setColorThemeState((current) => {
      const next: ColorTheme = current === "dark" ? "light" : "dark";
      writeColorThemePreference(next);
      return next;
    });
  }, []);

  return {
    colorTheme,
    isLight: colorTheme === "light",
    setColorTheme,
    toggleColorTheme,
  };
};
