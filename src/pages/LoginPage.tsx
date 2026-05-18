import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Moon, Sun } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext";

export function LoginPage({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/apps" replace />;  
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Login ID and password are required.");
      return;
    }

    try {
      setLoading(true);
      await login(email.trim(), password);
      navigate((location.state as { from?: string } | null)?.from || "/apps", {
        replace: true,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to sign in. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
        <section className="login-brand">
          <div className="brand-watermark">BAYANAT TECHNOLOGY</div>
          <div className="brand-mark">
            <img src="/bayanat-logo.png" alt="Bayanat Technology" className="login-logo" />
            <div>
              <strong>Bayanat Technology</strong>
              <span>Enterprise Operations</span>
            </div>
          </div>
          <div className="brand-copy">
            <h1>Accounts, WMS, HR and approvals in one secure console.</h1>
          </div>
          <div className="brand-status">
            <span>Version 0.1</span>
          </div>
        </section>

        <section className="login-panel">
          <button className="icon-button theme-toggle" onClick={onToggleTheme} type="button">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <form className="login-card" onSubmit={handleSubmit}>
            <div className="login-heading">
              <div className="login-icon">
                <LockKeyhole size={22} />
              </div>
              <div>
                <h2>Welcome back</h2>
                <p>Sign in with your Bayanat credentials.</p>
              </div>
            </div>

            {error && <div className="alert error">{error}</div>}

            <label className="field">
              <span>Login ID or Email</span>
              <input
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="e.g. sagar.b"
              />
            </label>

            <label className="field">
              <span>Password</span>
              <div className="password-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter password"
                />
                <button type="button" onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            <button className="primary-button" disabled={loading} type="submit">
              {loading ? <span className="spinner small" /> : "Sign In"}
            </button>

            <p className="support-copy">Password reset will be connected after login shell validation.</p>
          </form>
        </section>
    </main>
  );
}
