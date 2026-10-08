import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MembershipProvider } from "@/lib/membership-store";
import { WorkspaceProvider } from "@/lib/workspace-store";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/demo-auth";
import { money } from "@/lib/finance";
import { Route as LoginRoute } from "@/routes/login";
import { Route as RegisterRoute } from "@/routes/register";
import { Route as ForgotPasswordRoute } from "@/routes/forgot-password";
import { SignupCredentials } from "@/components/SignupCredentials";
import { Route as IndexRoute } from "@/routes/index";

const Login = LoginRoute.options.component!;
const Register = RegisterRoute.options.component!;
const ForgotPassword = ForgotPasswordRoute.options.component!;
const Index = IndexRoute.options.component!;

afterEach(cleanup);

function mount(path = "/") {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: () => (
      <MembershipProvider>
        <WorkspaceProvider>
          <Outlet />
        </WorkspaceProvider>
      </MembershipProvider>
    ),
  });
  const routes = [
    createRoute({ getParentRoute: () => root, path: "/", component: Index }),
    createRoute({ getParentRoute: () => root, path: "/login", component: Login }),
    createRoute({ getParentRoute: () => root, path: "/signup", component: SignupCredentials }),
    createRoute({ getParentRoute: () => root, path: "/register", component: Register }),
    createRoute({
      getParentRoute: () => root,
      path: "/forgot-password",
      component: ForgotPassword,
    }),
  ];
  const router = createRouter({
    routeTree: root.addChildren(routes),
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMinMs: 0,
  });
  render(<RouterProvider router={router} />);
}

function type(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function credentials(email = "ada@example.com", password = "MemberPass123!") {
  type("Email address", email);
  type("Password", password);
  type("Confirm password", password);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: /Continue to membership/ }));
}
async function completeRegistration() {
  await screen.findByRole("heading", { name: "Become a member" });
  type("Full name", "Ada Nwosu");
  type("Phone number", "08031112222");
  type("PCN registration number", "PCN/99999");
  type("Pharmacy name", "Ada Community Pharmacy");
  type("Premises licence number", "PL/9999");
  for (const group of screen.getAllByRole("group")) {
    const fields = within(group);
    fireEvent.change(fields.getByLabelText("Street address"), {
      target: { value: "12 Community Road" },
    });
    fireEvent.change(fields.getByLabelText("City"), { target: { value: "Ikeja" } });
    fireEvent.change(fields.getByLabelText("State"), { target: { value: "Lagos" } });
  }
  type("Bank name", "Sample Bank");
  type("Account number (10 digits)", "0123456789");
  fireEvent.click(screen.getByRole("button", { name: "Create account & join cooperative" }));
  await screen.findByRole("heading", { name: "Welcome, Ada" });
}

describe("Demo login and signup", () => {
  it("opens login for an unsigned member and validates login attempts", async () => {
    mount();
    await screen.findByRole("heading", { name: "Welcome back" });
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    type("Email address", DEMO_EMAIL);
    type("Password", "incorrect");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("email or password is incorrect");
    fireEvent.click(screen.getByRole("button", { name: "Use demo credentials" }));
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText(/Welcome back, Oyedamola/)).toBeInTheDocument();
    expect(screen.getByText("Oyedamola Moreira")).toBeInTheDocument();
  });

  it("routes the existing register entry through account creation", async () => {
    mount("/register");
    expect(await screen.findByRole("heading", { name: "Create your account" })).toBeInTheDocument();
  });

  it("validates signup passwords, eligibility, and duplicate email addresses", async () => {
    mount("/signup");
    await screen.findByRole("heading", { name: "Create your account" });
    type("Email address", "ada@example.com");
    type("Password", "short");
    type("Confirm password", "different");
    fireEvent.click(screen.getByRole("button", { name: /Continue to membership/ }));
    expect(await screen.findByText("Use at least 8 characters.")).toBeInTheDocument();
    expect(screen.getByText("Your passwords do not match.")).toBeInTheDocument();
    expect(screen.getByText("Confirm your eligibility to continue.")).toBeInTheDocument();
    credentials(`  ${DEMO_EMAIL.toUpperCase()}  `);
    expect(await screen.findByRole("alert")).toHaveTextContent("email already belongs to a member");
  });

  it("uses registration details for the signed-in dashboard and preserves activity across logout", async () => {
    mount("/signup");
    await screen.findByRole("heading", { name: "Create your account" });
    credentials();
    await screen.findByRole("heading", { name: "Become a member" });
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Email")).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Create account & join cooperative" }));
    expect(await screen.findByText("Please fix the highlighted fields.")).toBeInTheDocument();
    type("Full name", "Ada Nwosu");
    fireEvent.click(screen.getByRole("link", { name: "Back to account details" }));
    await screen.findByRole("heading", { name: "Create your account" });
    expect(screen.getByLabelText("Email address")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("MemberPass123!");
    fireEvent.click(screen.getByRole("button", { name: /Continue to membership/ }));
    await screen.findByRole("heading", { name: "Become a member" });
    expect(screen.getByLabelText("Full name")).toHaveValue("Ada Nwosu");
    await completeRegistration();
    expect(screen.getByText("AIC-000006")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Go to my dashboard" }));
    await screen.findByText(/Welcome back, Ada/);
    expect(screen.getByText("Ada Nwosu")).toBeInTheDocument();
    expect(screen.getByText("Total contributions").closest(".metric")).toHaveTextContent(money(0));
    fireEvent.click(screen.getByRole("button", { name: "Simulate contribution" }));
    expect(await screen.findByRole("status")).toHaveTextContent("contributed successfully");
    expect(screen.getByText("Total contributions").closest(".metric")).toHaveTextContent(
      money(5000000),
    );
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await screen.findByRole("heading", { name: "Welcome back" });
    type("Email address", "ADA@EXAMPLE.COM");
    type("Password", "MemberPass123!");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await screen.findByText(/Welcome back, Ada/);
    expect(screen.getByText("Total contributions").closest(".metric")).toHaveTextContent(
      money(5000000),
    );
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByLabelText("Full name")).toHaveValue("Ada Nwosu");
    expect(screen.getByLabelText("Pharmacy name")).toHaveValue("Ada Community Pharmacy");
  }, 15000);

  it("resets a demo password and accepts only the new password", async () => {
    mount("/forgot-password");
    await screen.findByRole("heading", { name: "Forgot your password?" });
    type("Email address", DEMO_EMAIL);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    type("New password", "UpdatedPass456!");
    type("Confirm new password", "UpdatedPass456!");
    fireEvent.click(screen.getByRole("button", { name: "Reset demo password" }));
    await screen.findByRole("heading", { name: "Password updated" });
    fireEvent.click(screen.getByRole("link", { name: "Return to log in" }));
    await screen.findByRole("heading", { name: "Welcome back" });
    type("Email address", DEMO_EMAIL);
    type("Password", DEMO_PASSWORD);
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("email or password is incorrect");
    type("Password", "UpdatedPass456!");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText(/Welcome back, Oyedamola/)).toBeInTheDocument();
  });
});
