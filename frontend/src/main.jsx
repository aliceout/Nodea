import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme/index.css";
import { MainKeyProvider } from "./hooks/useMainKey";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MainKeyProvider>
      <App />
    </MainKeyProvider>
  </StrictMode>
);

import App from "./App.jsx";