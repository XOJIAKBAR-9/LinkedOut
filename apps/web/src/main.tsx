import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./i18n";
import "./index.css";
import { queryClient } from "./lib/queryClient";
import { applyTheme, useTheme } from "./stores/theme";

applyTheme(useTheme.getState().theme);
window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(useTheme.getState().theme));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </HelmetProvider>
  </StrictMode>,
);
