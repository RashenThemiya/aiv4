import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ToastProvider } from "./components/ToastProvider.jsx";
import { DialogProvider } from "./components/DialogProvider.jsx";
import "./styles.css";
import { applyThemeMode, getInitialThemeMode } from "./lib/theme";

applyThemeMode(getInitialThemeMode(), { persist: false });

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </ToastProvider>
  </React.StrictMode>
);
