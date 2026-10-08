import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { PasswordField } from "@/components/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailSchema, passwordSchema } from "@/lib/demo-auth";
import { useMembership } from "@/lib/membership-store";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({ meta: [{ title: "Reset demo password | ACPN IDEA COOP" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const { currentMember, resetDemoPassword } = useMembership();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  if (currentMember) return <Navigate to="/" replace />;
  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const next: Record<string, string> = {};
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success)
      next["email"] = parsedEmail.error.issues[0]?.message ?? "Enter a valid email.";
    if (step === "reset") {
      const parsedPassword = passwordSchema.safeParse(password);
      if (!parsedPassword.success)
        next["password"] = parsedPassword.error.issues[0]?.message ?? "Enter a valid password.";
      if (password !== confirm) next["confirm"] = "Your passwords do not match.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    if (step === "email") {
      setStep("reset");
      return;
    }
    try {
      resetDemoPassword(email, password);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset this demo password.");
    }
  }
  return (
    <AuthLayout>
      <Link to="/login" className="auth-back">
        <ArrowLeft size={15} />
        Back to log in
      </Link>
      <div className="auth-heading-icon">
        {step === "done" ? <CheckCircle2 size={23} /> : <KeyRound size={23} />}
      </div>
      <div className="auth-eyebrow">LET'S GET YOU BACK IN</div>
      <h1>
        {step === "done"
          ? "Password updated"
          : step === "email"
            ? "Forgot your password?"
            : "Choose a new password"}
      </h1>
      <p className="auth-description">
        {step === "done"
          ? "Your demo password has been updated for this session. Log in with your new password."
          : "For this demo, you can reset your password here. No reset email is sent."}
      </p>
      {step === "done" ? (
        <Button asChild className="auth-submit mt-7">
          <Link to="/login">
            Return to log in
            <ArrowRight size={17} />
          </Link>
        </Button>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-field">
            <label htmlFor="reset-email">Email address</label>
            <Input
              id="reset-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors["email"])}
              aria-describedby={errors["email"] ? "reset-email-error" : undefined}
            />
            {errors["email"] && (
              <p id="reset-email-error" className="auth-error">
                {errors["email"]}
              </p>
            )}
          </div>
          {step === "reset" && (
            <>
              <PasswordField
                id="reset-password"
                label="New password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors["password"]}
              />
              <p className="auth-field-hint">
                Use at least 8 characters, including a letter and a number.
              </p>
              <PasswordField
                id="reset-confirm"
                label="Confirm new password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                error={errors["confirm"]}
              />
            </>
          )}
          {error && (
            <p className="auth-alert" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="auth-submit">
            {step === "email" ? "Continue" : "Reset demo password"}
            <ArrowRight size={17} />
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
