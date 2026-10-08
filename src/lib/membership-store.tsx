import { createContext, useContext, useState, type ReactNode } from "react";
import {
  accountNumberFor,
  initialProfiles,
  memberSchema,
  type MemberDetails,
  type MemberProfile,
} from "./membership";
import { TODAY } from "./finance";
import {
  DEMO_PASSWORD,
  emailSchema,
  normalizeEmail,
  passwordSchema,
  type SignupDraft,
} from "./demo-auth";

type Store = {
  profiles: MemberProfile[];
  addMember: (details: MemberDetails, addedBy: "self" | "admin") => MemberProfile;
  updateMember: (id: string, details: MemberDetails) => void;
  currentMember: MemberProfile | null;
  signupDraft: SignupDraft | null;
  signupDetails: MemberDetails | null;
  saveSignupDetails: (details: MemberDetails) => void;
  startSignup: (draft: SignupDraft) => void;
  completeSignup: (details: MemberDetails) => MemberProfile;
  signIn: (email: string, password: string) => void;
  signOut: () => void;
  resetDemoPassword: (email: string, password: string) => void;
};
const Ctx = createContext<Store | null>(null);

export function MembershipProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState(initialProfiles);
  // Demo credentials and session exist only in React state, never in browser storage.
  const [passwords, setPasswords] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialProfiles().map((p) => [p.id, DEMO_PASSWORD])),
  );
  const [currentMemberId, setCurrentMemberId] = useState<string | null>(null);
  const [signupDraft, setSignupDraft] = useState<SignupDraft | null>(null);
  const [signupDetails, saveSignupDetails] = useState<MemberDetails | null>(null);
  function ensureUniqueEmail(email: string, exceptId?: string) {
    if (
      profiles.some((p) => p.id !== exceptId && normalizeEmail(p.email) === normalizeEmail(email))
    )
      throw new Error("This email already belongs to a member. Please log in instead.");
  }
  function addMember(details: MemberDetails, addedBy: "self" | "admin") {
    const parsed = memberSchema.parse(details);
    ensureUniqueEmail(parsed.email);
    if (profiles.some((p) => p.pcnNumber.toLowerCase() === parsed.pcnNumber.toLowerCase()))
      throw new Error("A member with this PCN number already exists.");
    const profile: MemberProfile = {
      ...parsed,
      id: `m${profiles.length + 1}`,
      accountNumber: accountNumberFor(profiles.length + 1),
      joined: TODAY,
      addedBy,
    };
    setProfiles((prev) => [...prev, profile]);
    if (addedBy === "admin") setPasswords((prev) => ({ ...prev, [profile.id]: DEMO_PASSWORD }));
    return profile;
  }
  function updateMember(id: string, details: MemberDetails) {
    const parsed = memberSchema.parse(details);
    ensureUniqueEmail(parsed.email, id);
    setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...parsed } : p)));
  }
  function startSignup(draft: SignupDraft) {
    const email = emailSchema.parse(draft.email);
    const password = passwordSchema.parse(draft.password);
    ensureUniqueEmail(email);
    setSignupDraft({ email, password });
  }
  function completeSignup(details: MemberDetails) {
    if (!signupDraft) throw new Error("Create your login details first.");
    const profile = addMember({ ...details, email: signupDraft.email }, "self");
    setPasswords((prev) => ({ ...prev, [profile.id]: signupDraft.password }));
    setCurrentMemberId(profile.id);
    setSignupDraft(null);
    saveSignupDetails(null);
    return profile;
  }
  function signIn(email: string, password: string) {
    const profile = profiles.find((p) => normalizeEmail(p.email) === normalizeEmail(email));
    if (!profile || passwords[profile.id] !== password)
      throw new Error("The email or password is incorrect. Please try again.");
    setCurrentMemberId(profile.id);
    setSignupDraft(null);
    saveSignupDetails(null);
  }
  function signOut() {
    setCurrentMemberId(null);
    setSignupDraft(null);
    saveSignupDetails(null);
  }
  function resetDemoPassword(email: string, password: string) {
    const parsedEmail = emailSchema.parse(email);
    const parsedPassword = passwordSchema.parse(password);
    const profile = profiles.find((p) => normalizeEmail(p.email) === normalizeEmail(parsedEmail));
    if (!profile)
      throw new Error("No demo account was found for this email. You can create one with Sign up.");
    setPasswords((prev) => ({ ...prev, [profile.id]: parsedPassword }));
  }
  const currentMember = profiles.find((p) => p.id === currentMemberId) ?? null;
  return (
    <Ctx.Provider
      value={{
        profiles,
        addMember,
        updateMember,
        currentMember,
        signupDraft,
        signupDetails,
        saveSignupDetails,
        startSignup,
        completeSignup,
        signIn,
        signOut,
        resetDemoPassword,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useMembership() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useMembership must be used inside MembershipProvider");
  return v;
}
