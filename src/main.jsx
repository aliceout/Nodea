import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { MainKeyProvider } from "./hooks/useMainKey";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MainKeyProvider>
      <App />
    </MainKeyProvider>
  </StrictMode>
);
