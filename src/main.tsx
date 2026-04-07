import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { AppDataProvider } from "./context/AppDataContext.tsx";
import { Toaster } from "./app/components/ui/sonner.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <AppDataProvider>
    <App />
    <Toaster richColors position="top-center" />
  </AppDataProvider>,
);
  