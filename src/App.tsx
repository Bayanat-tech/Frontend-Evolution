import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { AppSelectionPage } from "./pages/AppSelectionPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { useAuth } from "./state/AuthContext";
import { ToastProvider } from "./components/ui/AlertToast";
import "../src/styles.css";
import { WmsBootScreen } from "./components/BootScreen";

export function App() {
  const { isBooting } = useAuth();
  const location = useLocation();
  const [authDark, setAuthDark] = useState(() => sessionStorage.getItem("bayanat_auth_theme") !== "light");
  const [workspaceDark, setWorkspaceDark] = useState(() => localStorage.getItem("bayanat_workspace_theme") === "dark");

  useEffect(() => {
    localStorage.removeItem("bayanat_auth_theme");
    sessionStorage.setItem("bayanat_auth_theme", authDark ? "dark" : "light");
  }, [authDark]);

  useEffect(() => {
    localStorage.setItem("bayanat_workspace_theme", workspaceDark ? "dark" : "light");
  }, [workspaceDark]);

  const toggleAuthTheme = () => setAuthDark((value) => !value);
  const toggleWorkspaceTheme = () => setWorkspaceDark((value) => !value);
  const isAuthRoute = location.pathname === "/login" || location.pathname === "/reset-password";
  const activeDark = isAuthRoute ? authDark : workspaceDark;

  // if (isBooting) {
  //   return (
  //     <div className="boot-screen">
  //       <div className="spinner" />
  //       <span>Starting secure workspace...</span>
  //     </div>
  //   );
  // }

if (isBooting) {
  return <WmsBootScreen />;
}

  return (
    <div className={activeDark ? "app dark" : "app"}>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage dark={authDark} onToggleTheme={toggleAuthTheme} />} />
          <Route path="/reset-password" element={<ResetPasswordPage dark={authDark} onToggleTheme={toggleAuthTheme} />} />
          <Route
          path="/apps"
          element={
            <ProtectedRoute>
              <AppSelectionPage dark={workspaceDark} onToggleTheme={toggleWorkspaceTheme} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workspace/:appCode/*"
          element={
            <ProtectedRoute>
              <WorkspacePage dark={workspaceDark} onToggleTheme={toggleWorkspaceTheme} />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/apps" replace />} />
      </Routes>
    </ToastProvider>
    </div>
  );
}
