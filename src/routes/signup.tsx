import { createFileRoute } from "@tanstack/react-router";
import { SignupCredentials } from "@/components/SignupCredentials";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Sign up | ACPN IDEA COOP" }] }),
  component: SignupCredentials,
});
