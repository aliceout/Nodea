import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StoreProvider } from "@/core/store/StoreProvider";
// Adjusted path: the theme folder lives under ui/theme, not ./theme
import "@/ui/theme/index.css";

import App from "@/app/App.jsx";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);
