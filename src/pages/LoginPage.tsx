import { FormEvent, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Moon, Sun } from "lucide-react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { NoticeToast } from "../components/ui/NoticeToast";
import { forgotPasswordRequest } from "../api/auth";
import { useAuth } from "../state/AuthContext";

type NoticeState = { type: "success" | "error" | "info" | "warning"; message: string } | null;

export function LoginPage({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [loading, setLoading] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/apps" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    if (!email.trim() || !password.trim()) {
      setNotice({ type: "error", message: "Login ID and password are required." });
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
      setNotice({ type: "error", message });
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (value: string) => {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailPattern.test(value.trim());
  };

  const handleForgotPasswordSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    const trimmedEmail = forgotEmail.trim();

    if (!trimmedEmail) {
      setNotice({ type: "error", message: "Email address is required." });
      return;
    }

    if (!isValidEmail(trimmedEmail)) {
      setNotice({ type: "error", message: "Please enter a valid email address." });
      return;
    }

    try {
      setForgotLoading(true);
      const result = await forgotPasswordRequest(trimmedEmail);
      if (!result.success) {
        throw new Error(result.message || "Unable to send password reset instructions.");
      }

      setForgotEmail("");
      setNotice({ type: "success", message: result.message || "Password reset instructions have been sent to your email." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send password reset instructions.";
      setNotice({ type: "error", message });
    } finally {
      setForgotLoading(false);
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

        {isForgotPassword ? (
          <form className="login-card" onSubmit={handleForgotPasswordSubmit}>
            <div className="login-heading">
              <div className="login-icon">
                <LockKeyhole size={22} />
              </div>
              <div>
                <h2>Reset or change password</h2>
                <p>Enter your registered email and we’ll send you a secure reset link.</p>
              </div>
            </div>

            <NoticeToast notice={notice} onClose={() => setNotice(null)} />

            <label className="field">
              <span>Email address</span>
              <input
                autoFocus
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                placeholder="Enter your email address"
              />
            </label>

            <button className="primary-button" disabled={forgotLoading} type="submit">
              {forgotLoading ? <span className="spinner small" /> : "Send reset link"}
            </button>

            <button className="secondary-button" onClick={() => { setIsForgotPassword(false); setNotice(null); }} type="button">
              Back to sign in
            </button>
          </form>
        ) : (
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

            <NoticeToast notice={notice} onClose={() => setNotice(null)} />

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

            <button className="secondary-button" onClick={() => { setIsForgotPassword(true); setNotice(null); }} type="button">
              Forgot or need to change password?
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
