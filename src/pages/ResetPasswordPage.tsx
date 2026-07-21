import { FormEvent, useMemo, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Moon, Sun } from "lucide-react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { resetPasswordRequest } from "../api/auth";
import { NoticeToast } from "../components/ui/NoticeToast";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useAuth } from "../state/AuthContext";

type NoticeState = { type: "success" | "error" | "info" | "warning"; message: string } | null;

export function ResetPasswordPage({ dark, onToggleTheme }: { dark: boolean; onToggleTheme: () => void }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tokenFromLink = useMemo(() => searchParams.get("token") || "", [searchParams]);
  const emailFromLink = useMemo(() => searchParams.get("email") || "", [searchParams]);
  const [email, setEmail] = useState(emailFromLink);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/apps" replace />;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);

    if ((!tokenFromLink && !email.trim()) || !password || !confirmPassword) {
      setNotice({ type: "error", message: "Reset link, new password and confirmation are required." });
      return;
    }

    if (password !== confirmPassword) {
      setNotice({ type: "error", message: "New password and confirmation do not match." });
      return;
    }

    try {
      setLoading(true);
      const result = await resetPasswordRequest({
        email: tokenFromLink ? undefined : email.trim(),
        password,
        token: tokenFromLink || undefined,
      });
      if (!result.success) {
        throw new Error(result.message || "Unable to reset password.");
      }

      setNotice({ type: "success", message: result.message || "Password has been reset successfully." });
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reset password.";
      setNotice({ type: "error", message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-brand">
        <img src="/bayanat-logo.png" alt="" className="brand-logo-watermark" aria-hidden="true" />
        <div className="brand-watermark">B</div>
        <div className="brand-mark">
          <img src="/bayanat-logo.png" alt="Bayanat Technology" className="login-logo" />
          <div>
            <strong>Bayanat Technology</strong>
            <span>Enterprise Resource Planning</span>
          </div>
        </div>
        <div className="brand-copy">
          <h1 className="brand-title">
            <span>Enterprise Resource Planning</span>
            <strong>ERP</strong>
          </h1>
        </div>
        <div className="brand-status">
          <span>Secure business console</span>
        </div>
      </section>

      <section className="login-panel">
        <Button className="theme-toggle" onClick={onToggleTheme} type="button" variant="outline" aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
          {dark ? <Sun size={18} /> : <Moon size={18} />}
          <span>{dark ? "Light" : "Dark"}</span>
        </Button>

        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-heading">
            <div className="login-icon">
              <LockKeyhole size={22} />
            </div>
            <div>
              <h2>Reset password</h2>
              <p>Set a new password for your Bayanat account.</p>
            </div>
          </div>

          <NoticeToast notice={notice} onClose={() => setNotice(null)} />

          {!tokenFromLink ? (
            <label className="field">
              <span>Email address</span>
              <Input
                autoFocus={!emailFromLink}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email address"
              />
            </label>
          ) : null}

          <label className="field">
            <span>New password</span>
            <div className="password-field">
              <Input
                autoFocus={Boolean(emailFromLink || tokenFromLink)}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter new password"
              />
              <Button className="password-toggle" type="button" onClick={() => setShowPassword((value) => !value)} variant="ghost" size="icon" aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </Button>
            </div>
          </label>

          <label className="field">
            <span>Confirm password</span>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
            />
          </label>

          <Button className="login-submit" disabled={loading} type="submit">
            {loading ? <span className="spinner small" /> : "Update Password"}
          </Button>

          <Button className="secondary-button" variant="outline" asChild>
            <Link to="/login">Back to sign in</Link>
          </Button>
        </form>
      </section>
    </main>
  );
}
