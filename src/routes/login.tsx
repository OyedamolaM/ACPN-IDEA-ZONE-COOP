import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ArrowRight, LogIn, Sparkles } from "lucide-react";
import { AuthLayout } from "@/components/AuthLayout";
import { PasswordField } from "@/components/PasswordField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEMO_EMAIL, DEMO_PASSWORD, emailSchema } from "@/lib/demo-auth";
import { useMembership } from "@/lib/membership-store";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in | ACPN IDEA COOP" }] }),
  component: Login,
});

function Login() {
  const { currentMember, signIn } = useMembership();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  if (currentMember) return <Navigate to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const checkedEmail = emailSchema.safeParse(email);
    const next: Record<string, string> = {};
    if (!checkedEmail.success)
      next["email"] = checkedEmail.error.issues[0]?.message ?? "Enter a valid email.";
    if (!password) next["password"] = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      signIn(email, password);
      await navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="auth-heading-icon">
        <LogIn size={23} />
      </div>
      <div className="auth-eyebrow">YOUR MEMBER WORKSPACE</div>
      <h1>Welcome back</h1>
      <p className="auth-description">
        Log in to keep building your savings and your shared future.
      </p>
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="auth-field">
          <label htmlFor="login-email">Email address</label>
          <Input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder="you@yourpharmacy.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errors["email"])}
            aria-describedby={errors["email"] ? "login-email-error" : undefined}
          />
          {errors["email"] && (
            <p id="login-email-error" className="auth-error">
              {errors["email"]}
            </p>
          )}
        </div>
        <PasswordField
          id="login-password"
          label="Password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors["password"]}
        />
        <div className="auth-forgot">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        {error && (
          <p className="auth-alert" role="alert">
            {error}
          </p>
        )}
        <Button className="auth-submit" type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
          <ArrowRight size={17} />
        </Button>
      </form>
      <p className="auth-switch">
        New to the cooperative? <Link to="/signup">Create an account</Link>
      </p>
      <div className="auth-demo">
        <div>
          <Sparkles size={17} />
          <strong>Take a look around</strong>
          <span>DEMO</span>
        </div>
        <p>
          Try the sample member account to explore savings, investments and the admin simulation.
        </p>
        <dl>
          <div>
            <dt>Email</dt>
            <dd>{DEMO_EMAIL}</dd>
          </div>
          <div>
            <dt>Password</dt>
            <dd>{DEMO_PASSWORD}</dd>
          </div>
        </dl>
        <Button
          variant="outline"
          className="w-full"
          type="button"
          onClick={() => {
            setEmail(DEMO_EMAIL);
            setPassword(DEMO_PASSWORD);
            setErrors({});
            setError("");
          }}
        >
          Use demo credentials
          <ArrowRight size={15} />
        </Button>
      </div>
    </AuthLayout>
  );
}
