import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, UserPlus } from "lucide-react";
import { AuthLayout } from "./AuthLayout";
import { PasswordField } from "./PasswordField";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { useMembership } from "@/lib/membership-store";
import { signupSchema } from "@/lib/demo-auth";

export function SignupCredentials() {
  const { currentMember, signupDraft, startSignup } = useMembership();
  const navigate = useNavigate();
  const [values, setValues] = useState({
    email: signupDraft?.email ?? "",
    password: signupDraft?.password ?? "",
    confirmPassword: signupDraft?.password ?? "",
    accepted: Boolean(signupDraft),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (currentMember) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      startSignup(parsed.data);
      await navigate({ to: "/register" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }
  const rules = [
    { label: "8+ characters", met: values.password.length >= 8 },
    { label: "A letter", met: /[A-Za-z]/.test(values.password) },
    { label: "A number", met: /[0-9]/.test(values.password) },
  ];
  return (
    <AuthLayout>
      <div className="auth-stepper" aria-label="Signup progress">
        <span aria-current="step">
          <b>1</b>Account details
        </span>
        <i />
        <span>
          <b>2</b>Membership
        </span>
      </div>
      <div className="auth-heading-icon">
        <UserPlus size={23} />
      </div>
      <div className="auth-eyebrow">START YOUR JOURNEY</div>
      <h1>Create your account</h1>
      <p className="auth-description">
        First, set up your login. Then tell us about yourself and your pharmacy.
      </p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="signup-email">Email address</label>
          <Input
            id="signup-email"
            type="email"
            autoComplete="email"
            placeholder="you@yourpharmacy.com"
            value={values.email}
            onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
            aria-invalid={Boolean(errors["email"])}
            aria-describedby={errors["email"] ? "signup-email-error" : undefined}
          />
          {errors["email"] && (
            <p id="signup-email-error" className="auth-error">
              {errors["email"]}
            </p>
          )}
        </div>
        <PasswordField
          id="signup-password"
          label="Password"
          autoComplete="new-password"
          placeholder="Create a password"
          value={values.password}
          onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
          error={errors["password"]}
          aria-describedby="password-rules"
        />
        <div id="password-rules" className="auth-password-rules">
          {rules.map((r) => (
            <span key={r.label} className={r.met ? "met" : ""}>
              <Check size={12} />
              {r.label}
            </span>
          ))}
        </div>
        <PasswordField
          id="signup-confirm"
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Enter your password again"
          value={values.confirmPassword}
          onChange={(e) => setValues((v) => ({ ...v, confirmPassword: e.target.value }))}
          error={errors["confirmPassword"]}
        />
        <div>
          <label className="auth-checkbox">
            <input
              type="checkbox"
              checked={values.accepted}
              onChange={(e) => setValues((v) => ({ ...v, accepted: e.target.checked }))}
              aria-invalid={Boolean(errors["accepted"])}
              aria-describedby={errors["accepted"] ? "eligibility-error" : undefined}
            />
            <span>
              I confirm that I am a licensed community pharmacist and wish to join the cooperative.
            </span>
          </label>
          {errors["accepted"] && (
            <p id="eligibility-error" className="auth-error mt-2">
              {errors["accepted"]}
            </p>
          )}
        </div>
        {error && (
          <p className="auth-alert" role="alert">
            {error}
          </p>
        )}
        <Button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? "Continuing…" : "Continue to membership"}
          <ArrowRight size={17} />
        </Button>
      </form>
      <p className="auth-switch">
        Already a member? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
