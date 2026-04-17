import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StoreProvider } from "@/core/store/StoreProvider";
import { I18nProvider } from "@/i18n/I18nProvider.jsx";
import { ErrorBoundary } from "@/ui/atoms/feedback/ErrorBoundary";
// Adjusted path: the theme folder lives under ui/theme, not ./theme
import "@/ui/theme/index.css";

import App from "@/app/App.jsx";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <StoreProvider>
          <App />
        </StoreProvider>
      </I18nProvider>
    </ErrorBoundary>
  </StrictMode>
);
