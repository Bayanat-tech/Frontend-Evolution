import { FormEvent, useState } from "react";
import {
  KeyRound,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  RefreshCw,
  Send,
} from "lucide-react";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { changePasswordRequest, forgotPasswordRequest } from "../api/auth";
import type { UserProfile } from "../types/auth";

type ResetPasswordModalProps = {
  open: boolean;
  onClose: () => void;
  user: UserProfile | null;
};

export function ResetPasswordModal({ open, onClose, user }: ResetPasswordModalProps) {
  const [activeTab, setActiveTab] = useState<"instant" | "email">("instant");

  // Instant Change Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [instantLoading, setInstantLoading] = useState(false);
  const [instantError, setInstantError] = useState<string | null>(null);
  const [instantSuccess, setInstantSuccess] = useState<string | null>(null);

  // Email Reset Link State
  const [emailInput, setEmailInput] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  if (!open) return null;

  const currentEmail = (
    user?.email_id ||
    user?.EMAIL_ID ||
    (user as any)?.email ||
    ""
  ).toString().trim();

  const currentLoginId = (
    user?.loginid ||
    user?.username ||
    "User"
  ).toString().trim();

  const handleClose = () => {
    setNewPassword("");
    setConfirmPassword("");
    setInstantError(null);
    setInstantSuccess(null);
    setEmailError(null);
    setEmailSuccess(null);
    onClose();
  };

  const handleInstantSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setInstantError(null);
    setInstantSuccess(null);

    const trimmedPassword = newPassword.trim();
    if (!trimmedPassword) {
      setInstantError("Please enter a new password.");
      return;
    }

    if (trimmedPassword.length < 6) {
      setInstantError("Password must be at least 6 characters long.");
      return;
    }

    if (trimmedPassword !== confirmPassword.trim()) {
      setInstantError("Passwords do not match.");
      return;
    }

    try {
      setInstantLoading(true);
      const identifier = currentLoginId || currentEmail;
      const res = await changePasswordRequest(trimmedPassword, identifier);
      if (res.success === false) {
        throw new Error(res.message || "Failed to update password.");
      }
      setInstantSuccess("Password has been changed successfully! You can use your new password next time you sign in.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setInstantError(err.message || "Unable to update password. Please try again.");
    } finally {
      setInstantLoading(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);

    const targetEmail = (emailInput.trim() || currentEmail).trim();
    if (!targetEmail) {
      setEmailError("Email address is required.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(targetEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    try {
      setEmailLoading(true);
      const res = await forgotPasswordRequest(targetEmail);
      if (res.success === false) {
        throw new Error(res.message || "Failed to send reset link.");
      }
      setEmailSuccess(res.message || `Password reset instructions have been sent to ${targetEmail}.`);
    } catch (err: any) {
      setEmailError(err.message || "Unable to send reset instructions.");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative bg-gradient-to-r from-blue-900 to-[#00378C] p-5 text-white">
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer absolute top-4 right-4 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <KeyRound className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white">Reset Password</h2>
              <p className="text-xs text-blue-100/90 font-medium mt-0.5">
                Account: <span className="font-semibold text-white underline decoration-blue-300">{currentLoginId}</span>
              </p>
            </div>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1.5 mt-4 p-1 rounded-xl bg-black/20 backdrop-blur-xs border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab("instant");
                setInstantError(null);
                setInstantSuccess(null);
              }}
              className={`cursor-pointer flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "instant"
                  ? "bg-white text-blue-950 shadow-sm"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <LockKeyhole size={13} />
              <span>Change Password</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("email");
                setEmailError(null);
                setEmailSuccess(null);
                if (!emailInput && currentEmail) {
                  setEmailInput(currentEmail);
                }
              }}
              className={`cursor-pointer flex-1 py-1.5 px-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === "email"
                  ? "bg-white text-blue-950 shadow-sm"
                  : "text-white/80 hover:text-white hover:bg-white/10"
              }`}
            >
              <Mail size={13} />
              <span>Send Reset Link</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5">
          {activeTab === "instant" ? (
            <form onSubmit={handleInstantSubmit} className="space-y-4">
              {instantSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40 p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2">
                    <CheckCircle2 size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Password Changed</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">{instantSuccess}</p>
                  <Button
                    type="button"
                    onClick={handleClose}
                    className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 rounded-lg"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  {instantError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                      <span>{instantError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>New Password</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Min. 6 characters</span>
                    </label>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter your new password"
                        autoFocus
                        className="pr-10 text-xs h-9.5 rounded-xl border-slate-300 dark:border-slate-700 focus:border-[#00378C] dark:focus:border-sky-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((v) => !v)}
                        className="cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                        tabIndex={-1}
                      >
                        {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your new password"
                        className="pr-10 text-xs h-9.5 rounded-xl border-slate-300 dark:border-slate-700 focus:border-[#00378C] dark:focus:border-sky-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        className="cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {newPassword && confirmPassword && (
                    <div className="text-[11px] flex items-center gap-1.5">
                      {newPassword === confirmPassword ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 size={13} /> Passwords match
                        </span>
                      ) : (
                        <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                          <AlertCircle size={13} /> Passwords do not match
                        </span>
                      )}
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                      disabled={instantLoading}
                      className="h-9 px-4 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={instantLoading || !newPassword.trim() || newPassword !== confirmPassword}
                      className="cursor-pointer h-9 px-5 text-xs font-semibold rounded-xl bg-[#00378C] hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
                    >
                      {instantLoading ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Updating...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={14} />
                          <span>Update Password</span>
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {emailSuccess ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/40 p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-2">
                    <CheckCircle2 size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-blue-900 dark:text-blue-200">Reset Email Sent</h4>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">{emailSuccess}</p>
                  <Button
                    type="button"
                    onClick={handleClose}
                    className="mt-4 w-full bg-[#00378C] hover:bg-blue-700 text-white font-semibold text-xs h-9 rounded-lg"
                  >
                    Close
                  </Button>
                </div>
              ) : (
                <>
                  {emailError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                      <span>{emailError}</span>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    We will send a secure password reset link to your registered email address, valid for 10 minutes.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Registered Email Address
                    </label>
                    <Input
                      type="email"
                      value={emailInput || currentEmail}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="Enter registered email"
                      className="text-xs h-9.5 rounded-xl border-slate-300 dark:border-slate-700 focus:border-[#00378C] dark:focus:border-sky-400"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                      disabled={emailLoading}
                      className="h-9 px-4 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={emailLoading || (!emailInput.trim() && !currentEmail)}
                      className="cursor-pointer h-9 px-5 text-xs font-semibold rounded-xl bg-[#00378C] hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
                    >
                      {emailLoading ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          <span>Send Reset Link</span>
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
