import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { AppSelectionPage } from "./pages/AppSelectionPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { useAuth } from "./state/AuthContext";
import { ToastProvider } from "./components/ui/AlertToast";

export function App() {
  const { isBooting } = useAuth();
  const [dark, setDark] = useState(() => localStorage.getItem("bayanat_theme") === "dark");

  useEffect(() => {
    localStorage.setItem("bayanat_theme", dark ? "dark" : "light");
  }, [dark]);

  const toggleTheme = () => setDark((value) => !value);

  if (isBooting) {
    return (
      <div className="boot-screen">
        <div className="spinner" />
        <span>Starting secure workspace...</span>
      </div>
    );
  }

  return (
    <div className={dark ? "app dark" : "app"}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage dark={dark} onToggleTheme={toggleTheme} />} />
          <Route
          path="/apps"
          element={
            <ProtectedRoute>
              <AppSelectionPage dark={dark} onToggleTheme={toggleTheme} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:appCode/*"
          element={
            <ProtectedRoute>
              <WorkspacePage dark={dark} onToggleTheme={toggleTheme} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/apps" replace />} />
      </Routes>
    </ToastProvider>
    </div>
  );
}
