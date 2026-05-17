import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { applyColorThemeToDocument, readColorThemePreference } from "./app/colorTheme";
import { App } from "./App";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./styles.css";

applyColorThemeToDocument(readColorThemePreference());

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root container '#root' was not found.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
