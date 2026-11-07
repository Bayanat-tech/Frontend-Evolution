import { FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import {
  LockKeyhole,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  X,
  Send,
  RefreshCw,
  ShieldCheck,
  ChevronRight,
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
  // Primary mode matches login screen: 'email' (Send reset link)
  // Also supports 'direct' (Change password directly)
  const [mode, setMode] = useState<"email" | "direct">("email");

  // Email Reset Link State (Same as Login Window)
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

  const [emailInput, setEmailInput] = useState(currentEmail);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // Direct Change Password State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [directLoading, setDirectLoading] = useState(false);
  const [directError, setDirectError] = useState<string | null>(null);
  const [directSuccess, setDirectSuccess] = useState<string | null>(null);

  if (!open) return null;

  const handleClose = () => {
    setEmailError(null);
    setEmailSuccess(null);
    setDirectError(null);
    setDirectSuccess(null);
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  // 1. Send Reset Link (Exact same logic as LoginPage.tsx handleForgotPasswordSubmit)
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
        throw new Error(res.message || "Unable to send password reset instructions.");
      }
      setEmailSuccess(
        res.message ||
          "Password reset instructions have been sent to your email. Check your inbox to set your new password."
      );
    } catch (err: any) {
      setEmailError(err.message || "Unable to send password reset instructions.");
    } finally {
      setEmailLoading(false);
    }
  };

  // 2. Direct Password Change (Optional instant update)
  const handleDirectSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setDirectError(null);
    setDirectSuccess(null);

    const trimmedPassword = newPassword.trim();
    if (!trimmedPassword) {
      setDirectError("Please enter a new password.");
      return;
    }

    if (trimmedPassword.length < 6) {
      setDirectError("Password must be at least 6 characters long.");
      return;
    }

    if (trimmedPassword !== confirmPassword.trim()) {
      setDirectError("Passwords do not match.");
      return;
    }

    try {
      setDirectLoading(true);
      const identifier = currentLoginId || currentEmail;
      const res = await changePasswordRequest(trimmedPassword, identifier);
      if (res.success === false) {
        throw new Error(res.message || "Failed to update password.");
      }
      setDirectSuccess("Password has been changed successfully! Please use your new password next time you sign in.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setDirectError(err.message || "Unable to update password. Please try again.");
    } finally {
      setDirectLoading(false);
    }
  };

  // Use createPortal to mount directly to document.body, guaranteeing the modal is never cut off or clipped by any header
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none animate-in fade-in duration-150"
      onClick={handleClose}
      style={{ margin: 0, padding: 16 }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl transition-all my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="relative bg-gradient-to-r from-blue-900 via-[#00378C] to-blue-800 px-6 py-5 text-white">
          <button
            type="button"
            onClick={handleClose}
            className="cursor-pointer absolute top-4 right-4 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0 mt-0.5">
              <LockKeyhole className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0 pr-6">
              <h2 className="text-base font-bold text-white tracking-tight">Reset or change password</h2>
              <p className="text-xs text-blue-100/90 font-normal mt-0.5 leading-snug">
                Account: <span className="font-semibold text-white">{currentLoginId}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {mode === "email" ? (
            /* Mode 1: Exact Same as Login Screen */
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {emailSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40 p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2">
                    <CheckCircle2 size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Reset Link Sent</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 leading-relaxed">
                    {emailSuccess}
                  </p>
                  <Button
                    type="button"
                    onClick={handleClose}
                    className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 rounded-xl"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Enter your registered email and we’ll send you a secure reset link (same as the login screen).
                  </p>

                  {emailError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                      <span>{emailError}</span>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>Email address</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Registered account email</span>
                    </label>
                    <Input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="Enter your email address"
                      autoFocus
                      className="text-xs h-10 rounded-xl border-slate-300 dark:border-slate-700 focus:border-[#00378C] dark:focus:border-sky-400 px-3"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                      disabled={emailLoading}
                      className="h-9.5 px-4 text-xs font-semibold rounded-xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={emailLoading || !emailInput.trim()}
                      className="cursor-pointer h-9.5 px-5 text-xs font-semibold rounded-xl bg-[#00378C] hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
                    >
                      {emailLoading ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>Sending link...</span>
                        </>
                      ) : (
                        <>
                          <Send size={13} />
                          <span>Send reset link</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Option to change password directly without email */}
                  <div className="pt-3 border-t border-border/60 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("direct");
                        setEmailError(null);
                        setEmailSuccess(null);
                      }}
                      className="cursor-pointer text-xs font-medium text-[#00378C] dark:text-sky-400 hover:underline inline-flex items-center gap-1"
                    >
                      <span>Or change password directly here</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : (
            /* Mode 2: Direct Password Change */
            <form onSubmit={handleDirectSubmit} className="space-y-4">
              {directSuccess ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/40 p-4 text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-2">
                    <CheckCircle2 size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Password Changed</h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1 leading-relaxed">{directSuccess}</p>
                  <Button
                    type="button"
                    onClick={handleClose}
                    className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 rounded-xl"
                  >
                    Done
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Set a new password directly for your account.
                  </p>

                  {directError && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                      <span>{directError}</span>
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
                        className="pr-10 text-xs h-10 rounded-xl border-slate-300 dark:border-slate-700 focus:border-[#00378C] dark:focus:border-sky-400"
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
                        className="pr-10 text-xs h-10 rounded-xl border-slate-300 dark:border-slate-700 focus:border-[#00378C] dark:focus:border-sky-400"
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
                      onClick={() => setMode("email")}
                      disabled={directLoading}
                      className="h-9.5 px-4 text-xs font-semibold rounded-xl"
                    >
                      Back to Send Reset Link
                    </Button>
                    <Button
                      type="submit"
                      disabled={directLoading || !newPassword.trim() || newPassword !== confirmPassword}
                      className="cursor-pointer h-9.5 px-5 text-xs font-semibold rounded-xl bg-[#00378C] hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
                    >
                      {directLoading ? (
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
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
