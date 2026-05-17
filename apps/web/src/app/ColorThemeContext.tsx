import { createContext, useContext, type ReactNode } from "react";

import { useColorTheme } from "./hooks/useColorTheme";

type ColorThemeContextValue = ReturnType<typeof useColorTheme>;

const ColorThemeContext = createContext<ColorThemeContextValue | null>(null);

type ColorThemeProviderProps = {
  children: ReactNode;
};

export const ColorThemeProvider = ({ children }: ColorThemeProviderProps): React.ReactElement => {
  const value = useColorTheme();
  return <ColorThemeContext.Provider value={value}>{children}</ColorThemeContext.Provider>;
};

export const useColorThemeContext = (): ColorThemeContextValue => {
  const value = useContext(ColorThemeContext);
  if (value === null) {
    throw new Error("useColorThemeContext must be used within ColorThemeProvider");
  }
  return value;
};
