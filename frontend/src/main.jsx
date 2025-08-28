import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./theme/index.css";
import { StoreProvider } from "./store/StoreProvider";



import App from "./App.jsx";
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);