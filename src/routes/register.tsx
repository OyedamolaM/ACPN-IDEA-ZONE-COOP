import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemberForm } from "@/components/MemberForm";
import { AuthLayout } from "@/components/AuthLayout";
import { COOP_NAME, emptyDetails, type MemberProfile } from "@/lib/membership";
import { useMembership } from "@/lib/membership-store";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: `Join ${COOP_NAME} — Community Pharmacists' Cooperative` },
      {
        name: "description",
        content: `Register as a member of ${COOP_NAME}. Open to licensed community pharmacists in Nigeria.`,
      },
      { property: "og:title", content: `Join ${COOP_NAME}` },
      { property: "og:description", content: "Membership registration for community pharmacists." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Register,
});

function Register() {
  const { currentMember, signupDraft, signupDetails, saveSignupDetails, completeSignup } =
    useMembership();
  const [done, setDone] = useState<MemberProfile | null>(null);
  if (!done && currentMember) return <Navigate to="/" replace />;
  if (!done && !signupDraft) return <Navigate to="/signup" replace />;
  const initial = { ...(signupDetails ?? emptyDetails()), email: signupDraft?.email ?? "" };
  return (
    <AuthLayout wide>
      {done ? (
        <div className="auth-success">
          <span className="auth-success-icon">
            <CheckCircle2 size={38} />
          </span>
          <div className="auth-eyebrow">YOU'RE PART OF THE COMMUNITY</div>
          <h1>Welcome, {done.fullName.split(" ")[0]}</h1>
          <p className="auth-description">
            Your membership is ready. You're signed in and all set to explore your workspace.
          </p>
          <div className="auth-account">
            <span>Your member account number</span>
            <strong>{done.accountNumber}</strong>
            <small>{done.email}</small>
          </div>
          <Button asChild className="auth-submit">
            <Link to="/">
              Go to my dashboard
              <ArrowRight size={17} />
            </Link>
          </Button>
          <p className="auth-description text-sm mt-5">
            This is a demo membership. No real account has been opened.
          </p>
        </div>
      ) : (
        <>
          <Link to="/signup" className="auth-back">
            <ArrowLeft size={15} />
            Back to account details
          </Link>
          <div className="auth-stepper" aria-label="Signup progress">
            <span className="complete">
              <b>
                <Check size={13} />
              </b>
              Account details
            </span>
            <i />
            <span aria-current="step">
              <b>2</b>Membership
            </span>
          </div>
          <div className="auth-eyebrow">ONE MORE STEP</div>
          <h1>Become a member</h1>
          <p className="auth-description">
            Tell us about yourself and your pharmacy. Membership is open to licensed community
            pharmacists.
          </p>
          <p className="auth-email-summary">
            Signing up as <strong>{signupDraft?.email}</strong>
          </p>
          <div className="auth-membership-form">
            <MemberForm
              initial={initial}
              onChange={saveSignupDetails}
              lockEmail
              submitLabel="Create account & join cooperative"
              onSubmit={(details) => {
                setDone(completeSignup(details));
              }}
            />
          </div>
          <p className="auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
